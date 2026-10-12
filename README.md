# QR Attendance — School Event Attendance with QR Codes

Expo (SDK 54) + TypeScript + expo-router + Supabase (Auth + Postgres + Realtime).
Dark anamorphic theme: deep-navy background `#04091F`, royal blue `#0B3098`,
crimson `#BD1B20`, wood brown `#3A1E14`, white text only — no white backgrounds.

## 1. Purpose

A school manages event attendance with QR codes: staff create events, the system
generates a QR code per event, students scan it to record attendance, and
teachers/admins monitor records live.

## 2. Roles and features

| Role | Tabs | Can do |
|---|---|---|
| Student | Home, Scan, Records, Profile | view open events, scan QR / enter code, record attendance, view own history |
| Teacher | Home, Events, Records, Profile | CRUD events, close/reopen, generate QR, monitor own events live |
| Admin | Home, Events, Records, Users, Profile | all teacher powers (all events) + manage roles + correct/delete rows |

QR flow: staff creates event, system generates QR, student scans, system
validates, attendance recorded, confirmation shown.

Validation blocks: duplicate check-ins (UNIQUE student+event plus pre-check),
closed events (app check plus DB trigger), invalid QR codes (strict parser, no
auto-creation), non-student recording (role guard plus RLS), and events outside
their time window (not-started / ended feedback).

Each check-in stores: student, event, date, time, and status
(present / late / absent, auto late after start time).

## 3. Setup

```powershell
npm install
Copy-Item .env.example .env   # then fill in EXPO_PUBLIC_SUPABASE_URL + ANON key
npx expo start                # press W for web, or scan with Expo Go 54
```

Database: open Supabase, SQL Editor, paste the whole `SUPABASE_SCHEMA.md` SQL
block (temporary paste file, byte-identical to `supabase/schema.sql`) and Run
once — tables, migration of existing rows, RLS, triggers, realtime included.
Then delete `SUPABASE_SCHEMA.md`. Register accounts in the app, then promote
one to admin:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';
```

Never commit `.env` or any service-role key. The app only uses the public anon
key; RLS enforces everything else server-side.

## 4. Database design

Relationships: auth.users 1-1 profiles; profiles 1-N events (created_by);
profiles 1-N attendance (student_id); events 1-N attendance (event_id).
Attendance has UNIQUE (student_id, event_id) so duplicates are impossible, and
corrected_by points at the admin who last fixed the row.

Tables: profiles (id, email, full_name, role student/teacher/admin); events
(code, title, date, start/end, venue, description, status open/closed,
created_by); attendance (student, event, attended_date, recorded_at, status).

## 5. Authentication vs authorization

Authentication: Supabase Auth email/password (hashed server-side), persisted
session via onAuthStateChange, secure sign-out. The session gate in
app/_layout.tsx redirects to /login when signed out.

Authorization: profiles.role drives lib/roles.ts helpers (isStaff, canScan,
canManageEvents, canViewAllAttendance, canManageUsers) used by the tab bar AND
every screen, while server-side RLS mirrors the same rules so bypassing the UI
still fails.

## 6. Event-driven programming (Event, Handler, Action, Result)

1. Login pressed — handleLogin — signInWithPassword — session, go Home.
2. Register pressed — handleRegister — signUp with name/role — profile created.
3. Sign Out pressed — handleSignOut — auth.signOut — session cleared, to login.
4. Auth state changes — onAuthStateChange — update context — screens react.
5. QR detected — handleBarCodeScanned — parse then registerAttendance — card ok
   or typed error banner.
6. Code button pressed — manual onPress — same pipeline as camera — works on web.
7. Event created — handleSave — validate then createEvent — new event plus QR.
8. Status toggled — toggleStatus — setEventStatus open/closed — pill flips and
   closed events reject scans.
9. DB row inserted — watchAttendance realtime channel — refetch — staff monitor
   updates live with no refresh.
10. Invalid QR — parseQrPayload — reject unknown format/code — invalid feedback.
11. Duplicate scan — pre-check plus unique constraint — abort — already-recorded
    warning.
12. Closed event scanned — status check plus DB trigger — abort — closed message.
13. Role changed — handleRoleChange — setUserRole — pill refreshes.
14. Data refreshed — pull-to-refresh / focus effects — reload — latest shown.

## 7. UI feedback

Glassmorphic dark cards on an animated anamorphic gradient (royal-blue, crimson,
brown streaks, SVG only, no white surfaces). LoadingState spinners,
FeedbackBanner success/error/warning tones, EmptyState guidance, status pills
(open/closed, present/late/absent, roles), inline form validation errors,
pull-to-refresh, and unauthorized lock screens.

## 8. Validation

```powershell
npx tsc --noEmit               # type check, must be clean
npx expo export --platform web # production bundle proof
npx expo start                 # manual walkthrough per section 2
```

Exam demo: register student plus teacher, promote admin via SQL, teacher creates
event, QR modal shows, student scans, try duplicate/closed/invalid cases, watch
the realtime monitor on a second device, admin corrects a row, sign out.


Triggers: handle_new_user auto-creates a profile on sign-up (copies name/role
from auth metadata); reject_closed_event_attendance rejects inserts for closed
events. Realtime publication includes attendance plus events.

