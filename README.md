# QR-ATT — Smart School Event-Class Attendance Management System

Expo (SDK 54) + TypeScript + expo-router + Supabase (Auth + Postgres + Realtime).
Dark anamorphic theme: deep-navy background `#04091F`, royal blue `#0B3098`,
crimson `#BD1B20`, wood brown `#3A1E14`, white text only — no white backgrounds.

## 1. Purpose

A school manages event/class attendance with QR codes: staff create events or
class schedules with a target audience, the system generates a QR code per
event, students scan it during Check-In / Check-Out windows to record
attendance, and teachers/admins monitor records live with summaries and rates.

## 2. Roles and features

| Role | Tabs | Can do |
|---|---|---|
| Student | Home, Scan, Events, Records, Profile | view targeted events (All / Scheduled filters), scan QR or enter code during check-in/out windows, record attendance, view own history with attendance rate + Present/Late/Absent tiles + status filter |
| Teacher | Home, Events, Records, Profile | create Event or Class-schedule attendance checks with target audience + multiple check-in/out windows, QR per event, realtime monitor, per-event summaries, CSV export |
| Admin | Home, Events, Records, Users, Profile | all teacher powers (all events) + full user CRUD (create logins via RPC, edit, delete) + correct/delete rows + overall rates & per-department report |

Registration: FULL NAME, EMAIL, STUDENT/PERSONNEL ID, role (Student/Teacher) —
students always give education details; teachers are asked if Advisory Teacher
(Yes → education details). Cascading dropdowns per level: College →
Department (BSIT, BSHM, BSEd, BSEd-Secondary, BPEd, BSEntrep) + Year 1-4 +
Block A-D; Senior High → Strand (STEM/ABM/TVL) + Grade 11-12 + Section;
Junior High → Grade 7-10 + Section; Elementary → Grade 1-6 + Section;
Kindergarten → Section. PASSWORD, CONFIRM PASSWORD, and Data Privacy Act
agreement are required.

Profile (read-only, centered): avatar icon → Role pill + Education badge →
FULL NAME → Student/Personnel ID → education line
(e.g. “BS Information Technology l 3rd Year l Block D”).

QR flow: staff creates event (Event or Class Schedule) with a target audience
(checkboxes: All, College, Senior High, Junior High, Elementary, Kindergarten —
or a specific advisory block/section) plus one or more Check-In / Check-Out
windows (e.g. in 7:20–8:20, out 12:00–13:00, in 13:20–14:00, out 17:00). The
system generates a QR code per event; students scan during the open window
(one row per window slot, duplicates blocked); confirmation shows the action,
window, and status.

Validation blocks: duplicate scans per window slot (UNIQUE student+event+slot
plus pre-check), closed events (app check plus DB trigger), invalid QR codes
(strict parser, no auto-creation), non-student recording (role guard plus RLS),
and scans outside any window (not-started / wrong-window / ended feedback).

Each scan stores: student, event, window slot, check-in/out action, time, and
the summary-row status (present / late / absent, auto late after event start).

Staff can export a per-event CSV; Records shows per-event present-vs-absent
percentages, an admin overall report, and per-department present rates.

## 3. Setup

```powershell
npm install
Copy-Item .env.example .env   # then fill in EXPO_PUBLIC_SUPABASE_URL + ANON key
npx expo start                # press W for web, or scan with Expo Go 54
```

Database: open Supabase, SQL Editor, paste the whole `supabase/schema.sql` file
and Run once — tables (profiles, events, attendance, attendance_scans),
migration of existing rows, RLS, triggers (incl. closed-event guard on scans),
admin user-RPCs, realtime included. Idempotent: safe to re-run and safe over
the existing database. `SUPABASE_SCHEMA.md` only holds the admin-seeding
steps. Then register staff/student accounts in the app and promote one to
admin:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';
```

Never commit `.env` or any service-role key. The app only uses the public anon
key; RLS enforces everything else server-side.

Relationships: auth.users 1-1 profiles; profiles 1-N events (created_by);
profiles 1-N attendance (student_id); events 1-N attendance (event_id);
attendance 1-N attendance_scans (one row per check-in/out slot).

Attendance (summary row) has UNIQUE (student_id, event_id); attendance_scans
has UNIQUE (student_id, event_id, slot) so repeat scans in the same window are
impossible, and corrected_by points at the admin who last fixed the row.

Tables: profiles (id, email, full_name, role student/teacher/admin,
student_no, education, department, year_level, block, strand, grade_level,
section, is_advisory); events (code, title, date, start/end, venue,
description, status open/closed, event_type event/class, target jsonb,
scan_windows jsonb, created_by); attendance (student, event, attended_date,
recorded_at, status); attendance_scans (attendance, student, event, slot,
action check_in/check_out).

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

