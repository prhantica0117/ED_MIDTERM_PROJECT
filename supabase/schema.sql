-- ============================================================
-- QR-ATT — Supabase PostgreSQL Schema (UNIFIED, idempotent)
-- ------------------------------------------------------------
-- Merges the existing online schema with every column the app
-- queries. Safe to run more than once AND safe over an existing
-- database: missing columns are added, existing data is kept
-- (no DROP TABLE anywhere).
--
-- APPLY: Supabase Dashboard → SQL Editor → New query → paste
-- this ENTIRE file → Run. Then see SUPABASE_SCHEMA.md STEP 2/3 to create
-- the admin@cctc.com superuser and promote it to admin.
-- (One-liner if the login already exists:
--   UPDATE public.profiles SET role = 'admin'
--   WHERE email = 'admin@cctc.com';)
-- ============================================================

-- ------------------------------------------------------------
-- 1. CREATE ALL TABLES FIRST
-- ------------------------------------------------------------

-- PROFILES TABLE (mirrors auth.users 1-to-1; role drives authorization)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  student_no text,
  -- education / advisory information (registration form)
  education text,
  department text,
  year_level text,
  block text,
  strand text,
  grade_level text,
  section text,
  is_advisory boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- EVENTS TABLE (staff-created; status gates attendance)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  event_date date,
  start_time timestamptz,
  end_time timestamptz,
  venue text,
  description text,
  status text not null default 'open' check (status in ('open', 'closed')),
  -- event ('Event') vs class ('Class Schedule') attendance checking
  event_type text not null default 'event',
  -- target audience: { "audiences": ["all"] } or ["college", ...] + class filters
  target jsonb not null default '{"audiences": ["all"]}'::jsonb,
  -- ordered check-in / check-out windows: [{slot, action, start, end}]
  scan_windows jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ATTENDANCE TABLE (one row per student per event — the summary/status row)
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  attended_date date not null default (now() at time zone 'utc')::date,
  recorded_at timestamptz not null default now(),
  status text not null default 'present'
    check (status in ('present', 'late', 'absent')),
  corrected_by uuid references auth.users (id) on delete set null,
  unique (student_id, event_id)
);

-- ATTENDANCE SCANS TABLE (one row per QR scan slot: check-in / check-out).
-- Students can scan several times per event (e.g. in 7:20-8:20, out 12:00-13:00,
-- in 13:20-14:00, out 17:00-…) — UNIQUE(student, event, slot) blocks repeats.
create table if not exists public.attendance_scans (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  slot integer not null default 0,
  action text not null default 'check_in' check (action in ('check_in', 'check_out')),
  scanned_at timestamptz not null default now(),
  unique (student_id, event_id, slot)
);

-- ------------------------------------------------------------
-- 1b. MIGRATE EXISTING DATABASES (guarded, no data loss)
-- ------------------------------------------------------------

-- profiles: allow the admin role (was student/teacher only)
do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('student', 'teacher', 'admin'));
exception when duplicate_object then null;
end $$;

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists student_no text;
alter table public.profiles add column if not exists education text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists year_level text;
alter table public.profiles add column if not exists block text;
alter table public.profiles add column if not exists strand text;
alter table public.profiles add column if not exists grade_level text;
alter table public.profiles add column if not exists section text;
alter table public.profiles add column if not exists is_advisory boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- events: every column the app reads/writes
alter table public.events add column if not exists event_date date;
alter table public.events add column if not exists venue text;
alter table public.events add column if not exists description text;
alter table public.events add column if not exists status text not null default 'open';
alter table public.events add column if not exists event_type text not null default 'event';
alter table public.events add column if not exists target jsonb not null default '{"audiences": ["all"]}'::jsonb;
alter table public.events add column if not exists scan_windows jsonb not null default '[]'::jsonb;

do $$
begin
  alter table public.events drop constraint if exists events_event_type_check;
  alter table public.events
    add constraint events_event_type_check
    check (event_type in ('event', 'class'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.events drop constraint if exists events_status_check;
  alter table public.events
    add constraint events_status_check check (status in ('open', 'closed'));
  alter table public.events drop constraint if exists events_end_after_start;
  alter table public.events
    add constraint events_end_after_start check (
      end_time is null or start_time is null or end_time > start_time
    );
exception when duplicate_object then null;
end $$;

-- attendance: rename scanned_at -> recorded_at (keeps old timestamps),
-- backfill attended_date, then make sure every app column exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance'
      and column_name = 'scanned_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance'
      and column_name = 'recorded_at'
  ) then
    alter table public.attendance rename column scanned_at to recorded_at;
  end if;
end $$;

alter table public.attendance add column if not exists recorded_at timestamptz not null default now();
alter table public.attendance add column if not exists attended_date date not null default (now() at time zone 'utc')::date;
alter table public.attendance add column if not exists status text not null default 'present';

do $$
begin
  alter table public.attendance drop constraint if exists attendance_status_check;
  alter table public.attendance
    add constraint attendance_status_check
    check (status in ('present', 'late', 'absent'));
exception when duplicate_object then null;
end $$;

alter table public.attendance add column if not exists corrected_by uuid references auth.users (id) on delete set null;

-- backfill attended_date for rows that predate the column
update public.attendance
set attended_date = (recorded_at at time zone 'utc')::date
where attended_date is null;

-- helpful indexes
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_events_status on public.events (status);
create index if not exists idx_events_created_by on public.events (created_by);
create index if not exists idx_attendance_student on public.attendance (student_id);
create index if not exists idx_attendance_event on public.attendance (event_id);
create index if not exists idx_scans_attendance on public.attendance_scans (attendance_id);
create index if not exists idx_scans_event on public.attendance_scans (event_id);
create index if not exists idx_scans_student on public.attendance_scans (student_id);

-- ------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_scans enable row level security;

-- ------------------------------------------------------------
-- 3. HELPER FUNCTIONS (role checks without policy recursion)
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 4. POLICIES — PROFILES
-- ------------------------------------------------------------
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = profiles.id
        and e.created_by = auth.uid()
    )
  );

drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
  on public.profiles for all
  to authenticated
  using (public.is_admin());

-- Staff (teachers/admins) read every profile so they can target events,
-- build attendance summaries and per-department rates.
drop policy if exists "Staff can view all profiles" on public.profiles;
create policy "Staff can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.my_role() in ('teacher', 'admin'));

-- ------------------------------------------------------------
-- 4b. POLICIES — EVENTS
-- ------------------------------------------------------------
drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user"
  on public.events for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can insert events" on public.events;
drop policy if exists "Staff can insert events" on public.events;
create policy "Staff can insert events"
  on public.events for insert
  with check (
    public.my_role() in ('teacher', 'admin')
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists "Users can update their own events" on public.events;
drop policy if exists "Owners or admins can update events" on public.events;
create policy "Owners or admins can update events"
  on public.events for update
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists "Owners or admins can delete events" on public.events;
create policy "Owners or admins can delete events"
  on public.events for delete
  using (created_by = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- 4c. POLICIES — ATTENDANCE
-- ------------------------------------------------------------
drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance"
  on public.attendance for select
  using (auth.uid() = student_id);

drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance"
  on public.attendance for insert
  with check (
    auth.uid() = student_id
    and public.my_role() = 'student'
  );

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events"
  on public.attendance for select
  using (
    exists (
      select 1 from public.events e
      where e.id = attendance.event_id
        and e.created_by = auth.uid()
    )
  );

drop policy if exists "Admins can update attendance" on public.attendance;
create policy "Admins can update attendance"
  on public.attendance for update
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can delete attendance" on public.attendance;
create policy "Admins can delete attendance"
  on public.attendance for delete
  to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- 4d. POLICIES — ATTENDANCE SCANS (check-in / check-out scans)
-- ------------------------------------------------------------
drop policy if exists "Students can view their own scans" on public.attendance_scans;
create policy "Students can view their own scans"
  on public.attendance_scans for select
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "Students can insert their own scans" on public.attendance_scans;
create policy "Students can insert their own scans"
  on public.attendance_scans for insert
  to authenticated
  with check (
    auth.uid() = student_id
    and public.my_role() = 'student'
  );

drop policy if exists "Staff can view scans for their events" on public.attendance_scans;
create policy "Staff can view scans for their events"
  on public.attendance_scans for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = attendance_scans.event_id
        and e.created_by = auth.uid()
    )
  );

drop policy if exists "Admins can update scans" on public.attendance_scans;
create policy "Admins can update scans"
  on public.attendance_scans for update
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can delete scans" on public.attendance_scans;
create policy "Admins can delete scans"
  on public.attendance_scans for delete
  to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- 5. TRIGGERS & FUNCTIONS
-- ------------------------------------------------------------

-- Auto-create profile on sign-up, copying name, role, ID and education data
-- from auth metadata (set by the app's signUp(); admin-created users get the
-- same metadata through admin_create_user()).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := 'student';
begin
  if (v_meta ->> 'role') in ('student', 'teacher', 'admin') then
    v_role := v_meta ->> 'role';
  end if;

  insert into public.profiles (
    id, email, full_name, role, student_no,
    education, department, year_level, block, strand, grade_level, section,
    is_advisory
  )
  values (
    new.id,
    new.email,
    nullif(v_meta ->> 'full_name', ''),
    v_role,
    nullif(v_meta ->> 'student_no', ''),
    nullif(v_meta ->> 'education', ''),
    nullif(v_meta ->> 'department', ''),
    nullif(v_meta ->> 'year_level', ''),
    nullif(v_meta ->> 'block', ''),
    nullif(v_meta ->> 'strand', ''),
    nullif(v_meta ->> 'grade_level', ''),
    nullif(v_meta ->> 'section', ''),
    coalesce((v_meta ->> 'is_advisory') in ('true', 't', '1'), false)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.updated_at fresh on every edit
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- DB-level guard: never record attendance for a closed event
create or replace function public.reject_closed_event_attendance()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.events where id = new.event_id;
  if v_status is distinct from 'open' then
    raise exception 'Event is closed — attendance cannot be recorded.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_reject_closed on public.attendance;
create trigger attendance_reject_closed
  before insert on public.attendance
  for each row execute function public.reject_closed_event_attendance();

-- Same guard for individual check-in / check-out scans
drop trigger if exists scans_reject_closed on public.attendance_scans;
create trigger scans_reject_closed
  before insert on public.attendance_scans
  for each row execute function public.reject_closed_event_attendance();

-- ------------------------------------------------------------
-- 5b. ADMIN USER MANAGEMENT (create / delete logins)
-- ------------------------------------------------------------
-- The app only holds the public anon key, so it cannot create or delete
-- Supabase Auth logins by itself. These SECURITY DEFINER functions run as
-- the function owner (created from the SQL editor) and are only callable
-- when public.is_admin() is true for the requesting user.

create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_student_no text default null,
  p_education text default null,
  p_department text default null,
  p_year_level text default null,
  p_block text default null,
  p_strand text default null,
  p_grade_level text default null,
  p_section text default null,
  p_is_advisory boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth, pg_temp
as $$
declare
  v_id uuid;
  v_meta jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can create users.' using errcode = '42501';
  end if;
  if p_role not in ('student', 'teacher', 'admin') then
    raise exception 'Invalid role: choose student, teacher or admin.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;
  if p_email is null or position('@' in p_email) < 2 then
    raise exception 'Enter a valid email address.';
  end if;
  if exists (
    select 1 from auth.users u where lower(u.email) = lower(p_email)
  ) then
    raise exception 'An account with that email already exists.';
  end if;

  v_id := gen_random_uuid();
  v_meta := jsonb_build_object(
    'full_name', p_full_name,
    'role', p_role,
    'student_no', p_student_no,
    'education', p_education,
    'department', p_department,
    'year_level', p_year_level,
    'block', p_block,
    'strand', p_strand,
    'grade_level', p_grade_level,
    'section', p_section,
    'is_advisory', coalesce(p_is_advisory, false)
  );

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    v_meta,
    now(),
    now()
  );

  -- email/password identity (schema differs across Supabase versions → guarded)
  begin
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities'
        and column_name = 'provider_id'
    ) then
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      )
      values (
        gen_random_uuid(), v_id, v_id::text,
        jsonb_build_object(
          'sub', v_id::text, 'email', lower(p_email),
          'email_verified', true, 'phone_verified', false
        ),
        'email', now(), now(), now()
      );
    else
      insert into auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      )
      values (
        gen_random_uuid(), v_id,
        jsonb_build_object(
          'sub', v_id::text, 'email', lower(p_email),
          'email_verified', true, 'phone_verified', false
        ),
        'email', now(), now(), now()
      );
    end if;
  exception when others then null;
    -- identity row is optional for email/password login; profile already exists
  end;

  return v_id;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, text, text, text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.admin_create_user(text, text, text, text, text, text, text, text, text, text, text, text, boolean) to authenticated;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can delete users.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;
  delete from auth.users where id = p_user_id;
  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. REALTIME (live teacher/admin attendance monitor)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_scans'
  ) then
    alter publication supabase_realtime add table public.attendance_scans;
  end if;
end $$;
