-- DEPRECATED: this file is superseded by supabase/schema.sql, which now
-- contains tables + migration + RLS + triggers + realtime in one paste-ready
-- file. Do NOT run this file on its own (it references the old app_role enum
-- which no longer exists). Kept for reference only.
-- ============================================================================
-- PART 2 — Row Level Security + realtime. Run AFTER Part 1.
-- ============================================================================

alter table public.profiles  enable row level security;
alter table public.events    enable row level security;
alter table public.attendance enable row level security;

-- Helper: is the caller an admin? (SECURITY DEFINER avoids recursion.)
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

-- Helper: caller's own role.
create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── profiles policies ───────────────────────────────────────────────────────
drop policy if exists "profiles_select_all_authed" on public.profiles;
create policy "profiles_select_all_authed"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all to authenticated using (public.is_admin());

-- ── events policies ─────────────────────────────────────────────────────────
drop policy if exists "events_select_all_authed" on public.events;
create policy "events_select_all_authed"
  on public.events for select to authenticated using (true);

drop policy if exists "events_staff_insert" on public.events;
create policy "events_staff_insert"
  on public.events for insert to authenticated
  with check (
    public.my_role() in ('teacher', 'admin')
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists "events_owner_or_admin_update" on public.events;
create policy "events_owner_or_admin_update"
  on public.events for update to authenticated
  using (created_by = auth.uid() or public.is_admin());

drop policy if exists "events_owner_or_admin_delete" on public.events;
create policy "events_owner_or_admin_delete"
  on public.events for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- ── attendance policies ─────────────────────────────────────────────────────
drop policy if exists "attendance_select_own_or_staff" on public.attendance;
create policy "attendance_select_own_or_staff"
  on public.attendance for select to authenticated
  using (
    student_id = auth.uid()
    or public.my_role() in ('teacher', 'admin')
  );

drop policy if exists "attendance_student_insert_own" on public.attendance;
create policy "attendance_student_insert_own"
  on public.attendance for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.my_role() = 'student'
  );

drop policy if exists "attendance_admin_update" on public.attendance;
create policy "attendance_admin_update"
  on public.attendance for update to authenticated
  using (public.is_admin());

drop policy if exists "attendance_admin_delete" on public.attendance;
create policy "attendance_admin_delete"
  on public.attendance for delete to authenticated
  using (public.is_admin());

-- ── Realtime (live teacher/admin monitor) ───────────────────────────────────
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
