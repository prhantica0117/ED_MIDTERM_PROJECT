# QR-ATT — Supabase Schema Execution Guide

This document walks you through setting up the Supabase database for the QR-ATT
Attendance Management System, step by step, using the **Supabase SQL Editor**.

> ⚠️ **Security reminder:** Never place passwords, secret keys, service-role
> keys, or other sensitive credentials directly in source code or a public Git
> repository. Supabase credentials live in .env (via EXPO_PUBLIC_SUPABASE_URL
> and EXPO_PUBLIC_SUPABASE_ANON_KEY) only.

---

## Prerequisites

1. A Supabase project created at [supabase.com](https://supabase.com).
2. The project URL and non public key copied from **Settings > API**.
3. Those values added to your app's .env file:
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
4. The schema file supabase/schema.sql present in your project.

---

## Overview of the Database Schema

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| profiles | User accounts & role-based identity (1-to-1 with auth.users) | id, email, full_name, role (student/teacher/admin), student_no, education fields, created_at, updated_at |
| events | QR-attendance events created by teachers/admins | id, event_code, title, event_date, start_time, end_time, venue, description, status (open/closed), created_by, created_at |
| attendance | One summary row per student per event | id, student_id, event_id, attended_date, recorded_at, status (present/late/absent), corrected_by |
| attendance_scans | One row per QR scan slot (check-in / check-out) | id, attendance_id, student_id, event_id, slot, action (check_in/check_out), scanned_at |

**Relationships:**

- profiles.id -> auth.users.id (1-to-1, cascade delete)
- events.created_by -> auth.users.id (who created the event)
- attendance.student_id -> auth.users.id (who attended)
- attendance.event_id -> events.id (which event)
- attendance_scans.attendance_id -> attendance.id (which summary row)
- attendance_scans.student_id -> auth.users.id
- attendance_scans.event_id -> events.id

---

## Step 1 - Open the Supabase SQL Editor

1. Log in to your Supabase Dashboard.
2. Select your project.
3. In the left sidebar, click **SQL Editor**.
4. Click **New query** (give it a name like qr-att-schema).

---

## Step 2 - Paste and Run the Schema

1. Open the file supabase/schema.sql in your code editor.
2. Select **all** the content (Ctrl+A / Cmd+A).
3. Copy it (Ctrl+C / Cmd+C).
4. Paste the **entire file** into the SQL Editor query pane.
5. Click the **Run** button (or press Ctrl+Enter / Cmd+Enter).

### What this single run creates/migrates

| Object | Description |
|--------|-------------|
| public.profiles | User profile table (idempotent CREATE TABLE IF NOT EXISTS) |
| public.events | Events table with event_code, status, scan_windows, etc. |
| public.attendance | Attendance summary (unique student + event) |
| public.attendance_scans | Per-scan check-in/check-out records |
| RLS policies | Row Level Security on all 4 tables |
| public.is_admin() | Helper - returns true if caller's profile role = admin |
| public.my_role() | Helper - returns caller's own role |
| public.handle_new_user() | Trigger - auto-creates a profile when a user signs up |
| public.touch_updated_at() | Trigger - keeps profiles.updated_at fresh |
| public.reject_closed_event_attendance() | Trigger - blocks attendance on closed events |
| public.admin_create_user(...) | RPC - lets admins create new auth users + profiles |
| public.admin_delete_user(...) | RPC - lets admins delete users |
| Realtime publication | Adds attendance, events, attendance_scans to supabase_realtime |

The schema is **idempotent** - safe to run more than once. It uses CREATE TABLE
IF NOT EXISTS, guarded ALTER TABLE ADD COLUMN IF NOT EXISTS, and DROP CONSTRAINT
IF EXISTS / CREATE CONSTRAINT patterns. No DROP TABLE anywhere, so existing data
is preserved.

---

## Step 3 - Verify the Tables Were Created

In the SQL Editor, open a **New query** and run:

`sql
-- 1. List all tables in the public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Confirm RLS is enabled on each table
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Confirm the helper functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
`

Expected tables: attendance, attendance_scans, events, profiles.

Expected functions: admin_create_user, admin_delete_user, handle_new_user,
is_admin, my_role, reject_closed_event_attendance, touch_updated_at.

---

## Step 4 - Create the Administrator Account

Passwords live in **Supabase Auth** (bcrypt-hashed), so SQL alone cannot create
a login with a known password. You must create the administrator through the
Dashboard:

### 4a. Add the user in Supabase Auth

1. In the Dashboard, go to **Authentication > Users**.
2. Click **Add user** > **Create new user**.
3. Fill in:
   - **Email:** admin@cctc.com
   - **Password:** admin123 (change this after your defense)
   - **Auto Confirm User:** **ON** (required - otherwise login is blocked waiting for email confirmation)
4. Click **Create**.

### 4b. Promote the user to administrator

Back in the **SQL Editor**, open a **New query** and run:

`sql
-- Promote admin@cctc.com to administrator role
UPDATE public.profiles
SET role = 'admin', full_name = 'System Administrator'
WHERE email = 'admin@cctc.com';
`

### 4c. Verify the promotion

`sql
SELECT id, email, full_name, role
FROM public.profiles
WHERE email = 'admin@cctc.com';
`

You should see exactly one row with role = admin.

You can now sign into the app as admin@cctc.com / admin123. The Admin tabs
(Events, Records, Users) appear automatically based on the role.

---

## Step 5 - Create Additional Users (Optional)

You can create teacher and student accounts two ways:

### Option A - In-app registration (students and teachers)

The app's registration screen calls signUp(email, password, metadata) which:
1. Creates the user in Supabase Auth.
2. Fires the handle_new_user trigger, which auto-creates a matching row in
   public.profiles copying full_name, role, student_no, and education fields
   from the auth metadata.

> Registration only offers student and teacher roles. The admin role cannot be
> self-registered - it must be promoted via SQL (Step 4b) or created via the
> admin_create_user RPC.

### Option B - Admin-created users (via the app or SQL)

The admin_create_user RPC lets an authenticated admin create a new Supabase Auth
login **and** profile in one call. Example SQL call (run as an admin):

`sql
SELECT public.admin_create_user(
  'teacher@cctc.com',      -- p_email
  'teacher123',            -- p_password
  'Jane Teacher',          -- p_full_name
  'teacher',               -- p_role
  NULL,                    -- p_student_no
  'College of Education',  -- p_education
  'Education',             -- p_department
  NULL,                    -- p_year_level
  NULL,                    -- p_block
  NULL,                    -- p_strand
  NULL,                    -- p_grade_level
  NULL,                    -- p_section
  true                     -- p_is_advisory
);
`

---

## Step 6 - Row Level Security (RLS) Summary

RLS is enabled on all four tables. Policies are enforced automatically by
Supabase for every query made with the anon key.

### Profiles (public.profiles)

| Policy | Who | What |
|--------|-----|------|
| Profiles are viewable by owner | Owner | SELECT own row |
| Users can insert their own profile | Owner | INSERT own row |
| Users can update their own profile | Owner | UPDATE own row (cannot change role) |
| Teachers can view profiles of their attendees | Teacher | SELECT profiles of students who attended their events |
| Admins can manage all profiles | Admin | ALL on all rows |
| Staff can view all profiles | Teacher, Admin | SELECT all rows |

### Events (public.events)

| Policy | Who | What |
|--------|-----|------|
| Events are readable by any authenticated user | All authenticated | SELECT all events |
| Staff can insert events | Teacher, Admin | INSERT (created_by must be self or null) |
| Owners or admins can update events | Creator / Admin | UPDATE own events or any event (admin) |
| Owners or admins can delete events | Creator / Admin | DELETE own events or any event (admin) |

### Attendance (public.attendance)

| Policy | Who | What |
|--------|-----|------|
| Students can view their own attendance | Student | SELECT own rows |
| Students can insert their own attendance | Student | INSERT own rows (role must be student) |
| Teachers can view attendance for their events | Teacher | SELECT attendance for events they created |
| Admins can update attendance | Admin | UPDATE any row |
| Admins can delete attendance | Admin | DELETE any row |

### Attendance Scans (public.attendance_scans)

| Policy | Who | What |
|--------|-----|------|
| Students can view their own scans | Student | SELECT own rows |
| Students can insert their own scans | Student | INSERT own rows (role must be student) |
| Staff can view scans for their events | Teacher, Admin | SELECT scans for their events |
| Admins can update scans | Admin | UPDATE any row |
| Admins can delete scans | Admin | DELETE any row |

---

## Step 7 - Triggers & Database-Level Guards

| Trigger | Table | Timing | Purpose |
|---------|-------|--------|---------|
| on_auth_user_created | auth.users | AFTER INSERT | Auto-creates a profiles row when a new user signs up (copies metadata). |
| profiles_touch_updated_at | profiles | BEFORE UPDATE | Sets updated_at = now() on every profile edit. |
| attendance_reject_closed | attendance | BEFORE INSERT | Raises an exception if the event status is not open (prevents attendance on closed events). |
| scans_reject_closed | attendance_scans | BEFORE INSERT | Same closed-event guard for individual check-in/check-out scans. |

### Database-level duplicate prevention

The attendance table has a UNIQUE(student_id, event_id) constraint - a student
can only have one summary row per event. The attendance_scans table has a
UNIQUE(student_id, event_id, slot) constraint - preventing repeat scans in the
same slot. These are enforced at the database level, so even if client-side
validation is bypassed, duplicates are rejected.

---

## Step 8 - Realtime (Live Attendance Monitoring)

The schema adds attendance, events, and attendance_scans to the
supabase_realtime publication. This enables the teacher/admin attendance
monitor to receive live updates when attendance records change.

To verify realtime is enabled:

`sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
`

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| role check constraint violation on profiles | Older database had role limited to student/teacher only | The schema migrates this automatically (Step 1b in schema.sql). Re-run the schema. |
| column recorded_at does not exist | Older schema used scanned_at | The schema renames scanned_at to recorded_at automatically. Re-run the schema. |
| Login blocked waiting for email confirmation | Auto Confirm User was OFF | In Dashboard > Authentication > Users, edit the user and turn Auto Confirm User ON. |
| permission denied for table profiles | RLS policy missing or user not authenticated | Ensure RLS policies were created (Step 2) and the client sends a valid session token. |
| Admin can't create/delete users | admin_create_user / admin_delete_user not callable | Confirm your profile has role = admin (Step 4c). These functions check public.is_admin(). |
| Duplicate attendance still recorded | Client-side validation only | The DB UNIQUE(student_id, event_id) constraint and closed-event trigger enforce this server-side. Check the console for the specific error. |

---

## Quick Reference: SQL Verification Queries

`sql
-- All tables + row counts
SELECT 'profiles' AS tbl, count(*) FROM public.profiles
UNION ALL SELECT 'events', count(*) FROM public.events
UNION ALL SELECT 'attendance', count(*) FROM public.attendance
UNION ALL SELECT 'attendance_scans', count(*) FROM public.attendance_scans;

-- All users with roles
SELECT id, email, full_name, role, created_at
FROM public.profiles
ORDER BY role, full_name;

-- All events with status
SELECT id, event_code, title, status, created_by, created_at
FROM public.events
ORDER BY created_at DESC;

-- Attendance summary per event
SELECT e.title, e.event_code, count(a.id) AS total_attendees
FROM public.events e
LEFT JOIN public.attendance a ON a.event_id = e.id
GROUP BY e.id, e.title, e.event_code
ORDER BY e.created_at DESC;
`

---

## Security Checklist (for your Final Examination)

- [ ] Authentication via Supabase Auth (email/password, bcrypt-hashed passwords).
- [ ] Session handling with expo-secure-store (native) / localStorage (web).
- [ ] Role-based authorization via public.is_admin() / public.my_role() and RLS policies.
- [ ] Database access protection - all tables have RLS enabled; anon key cannot bypass policies.
- [ ] Input validation - lib/validation.ts validates email, password, name, event code, and event forms.
- [ ] Duplicate attendance prevention - UNIQUE(student_id, event_id) + UNIQUE(student_id, event_id, slot) constraints.
- [ ] Closed-event guard - DB trigger reject_closed_event_attendance() blocks inserts on closed events.
- [ ] Secure session handling - signOut() invalidates the Supabase session and forces local state to null.
- [ ] Proper logout - clears SecureStore and redirects to login.
- [ ] Protected database operations - admin_create_user / admin_delete_user are SECURITY DEFINER and gated by is_admin().
- [ ] No secrets in source code - credentials only in .env (gitignored).
