# QR-ATT Supabase Setup

## STEP 1 — Run the schema

The canonical schema lives in `supabase/schema.sql`. Open Supabase Dashboard >
SQL Editor > New query, paste that ENTIRE file, and press Run. One file, one
run. Safe to re-run and safe over the existing database: no DROP TABLE
anywhere, missing columns are added, existing rows and timestamps are
preserved.

It creates/migrates `profiles` (incl. education fields), `events` (incl.
event_type / target / scan_windows), `attendance` (summary rows),
`attendance_scans` (one row per check-in/out slot), RLS policies, the
`handle_new_user` trigger, the closed-event guards, the
`admin_create_user` / `admin_delete_user` RPCs, and realtime publication.

## STEP 2 — Create the superuser (no in-app signup needed)

Passwords live in Supabase Auth (bcrypt-hashed), so SQL alone cannot set one.
Create the login in the Dashboard instead:

1. Supabase Dashboard > Authentication > Users > **Add user** > Create new user
2. Email: `admin@cctc.com`
3. Password: `admin123`
4. Turn **Auto Confirm User** ON (otherwise the app login is blocked waiting
   for email confirmation)
5. Save

## STEP 3 — Promote that login to administrator

Back in SQL Editor > New query, run:

```sql
UPDATE public.profiles SET role = 'admin', full_name = 'System Administrator'
WHERE email = 'admin@cctc.com';
```

Verify it took (expect one row, role = admin):

```sql
SELECT id, email, full_name, role FROM public.profiles
WHERE email = 'admin@cctc.com';
```

You can now open the app and sign in directly as `admin@cctc.com` / `admin123`
— no registration screen needed. The Admin tabs (Events, Records, Users)
appear automatically from the role.

> Demo account with a weak password: rotate `admin123` (Dashboard >
> Authentication > Users > admin@cctc.com > Reset password) after your defense.
