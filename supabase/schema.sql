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
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ATTENDANCE TABLE (one row per student per event)
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
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- events: every column the app reads/writes
alter table public.events add column if not exists event_date date;
alter table public.events add column if not exists venue text;
alter table public.events add column if not exists description text;
alter table public.events add column if not exists status text not null default 'open';

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

-- ------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

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
-- 5. TRIGGERS & FUNCTIONS
-- ------------------------------------------------------------

-- Auto-create profile on sign-up, copying name + role from auth metadata
-- (set by the app's signUp(); only student/teacher are offered at registration)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := 'student';
begin
  if (new.raw_user_meta_data ->> 'role') in ('student', 'teacher') then
    v_role := new.raw_user_meta_data ->> 'role';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    v_role
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
end $$;
