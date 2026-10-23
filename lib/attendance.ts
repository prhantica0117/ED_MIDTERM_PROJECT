import {
  eventMatchesProfile,
  educationLabel,
  type EventTarget,
  type EducationInfo,
} from '../constants/education';
import {
  getEventByCode,
  listEvents,
  parseEventTarget,
  type CloudEvent,
  type ScanAction,
  type ScanWindow,
} from './events';
import { getProfile, listProfiles, type Profile } from './profiles';
import { parseQRPayload, isValidWindow } from './qr';
import { supabase } from './supabase';
import { toLocalDateString } from './validation';

export type AttendanceStatus = 'present' | 'late' | 'absent';

/** Machine-readable failure reasons so the UI can give tailored feedback. */
export type ScanFailureCode =
  | 'invalid_qr'
  | 'event_missing'
  | 'closed'
  | 'not_started'
  | 'wrong_window'
  | 'ended'
  | 'duplicate'
  | 'unauthorized'
  | 'no_session'
  | 'db_error';

export type ScanResult =
  | {
      ok: true;
      event: { title: string; venue: string | null; eventCode: string };
      recordedAt: string;
      status: AttendanceStatus;
      action: ScanAction;
      slot: number;
      windowStart: string;
      windowEnd: string;
    }
  | { ok: false; code: ScanFailureCode; message: string };

function fail(code: ScanFailureCode, message: string): ScanResult {
  return { ok: false, code, message };
}

export function actionLabel(action: ScanAction): string {
  return action === 'check_out' ? 'Check Out' : 'Check In';
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The ordered check-in / check-out windows of an event.
 * Events created before scan windows existed fall back to a single check-in
 * window spanning the event start/end times.
 */
export function resolveScanWindows(event: CloudEvent): ScanWindow[] {
  if (event.scan_windows && event.scan_windows.length > 0) {
    return [...event.scan_windows].sort((a, b) => a.slot - b.slot);
  }
  if (event.start_time && event.end_time) {
    return [{ slot: 0, action: 'check_in', start: event.start_time, end: event.end_time }];
  }
  return [];
}

/**
 * QR attendance pipeline (event → handler → action → result):
 *  1. Parse/validate the QR payload              → invalid_qr
 *  2. Authorization: only students may record    → unauthorized
 *  3. Look the event up in the database          → event_missing (invalid QR)
 *  4. Event status must be "open"                → closed
 *  5. Resolve the check-in / check-out windows   → not_started / wrong_window / ended
 *  6. Duplicate check per window slot            → duplicate
 *  7. Ensure the attendance summary row          → late if after event start
 *  8. Insert the scan row (RLS + trigger guard)  → success / db_error
 */
export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<ScanResult> {
  // Step 1 — decode & structurally validate the QR payload
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) {
    return fail('invalid_qr', parsed.message);
  }

  // Step 2 — role check: students only (teachers/admins generate QR codes)
  const profile = await getProfile(studentId);
  if (!profile) {
    return fail('no_session', 'Session not found. Please sign in again.');
  }
  if (profile.role !== 'student') {
    return fail(
      'unauthorized',
      `Only student accounts can record attendance. You are signed in as ${profile.role}.`
    );
  }

  // Step 3 — the QR must reference an event that actually exists
  const event = await getEventByCode(parsed.payload.event);
  if (!event) {
    return fail('invalid_qr', 'Invalid QR code — this event does not exist.');
  }

  // Step 3b — TOTP time-window validation (current or previous 30s slot only)
  const payloadWindow = parsed.payload.window;
  if (typeof payloadWindow === 'number' && !isValidWindow(payloadWindow)) {
    return fail(
      'invalid_qr',
      'QR code has expired. Please ask the teacher to refresh the code.'
    );
  }

  // Step 4 — closed events reject attendance
  if (event.status !== 'open') {
    return fail('closed', `“${event.title}” is closed. Attendance can no longer be recorded.`);
  }

  // Step 5 — which check-in / check-out window are we in?
  // (source of truth = the database, not the QR image)
  const now = Date.now();
  const windows = resolveScanWindows(event);

  if (windows.length === 0) {
    return fail(
      'not_started',
      `“${event.title}” has no check-in schedule yet. Ask your teacher or administrator.`
    );
  }

  const active = windows.find((w) => now >= Date.parse(w.start) && now <= Date.parse(w.end));

  if (!active) {
    const first = windows[0];
    const last = windows[windows.length - 1];

    if (now < Date.parse(first.start)) {
      return fail(
        'not_started',
        `${actionLabel(first.action)} for “${event.title}” opens at ${formatClock(first.start)}.`
      );
    }
    if (now > Date.parse(last.end)) {
      return fail(
        'ended',
        `Scanning for “${event.title}” is finished — the last window closed at ${formatClock(
          last.end
        )}.`
      );
    }
    const next = windows.find((w) => now < Date.parse(w.start));
    if (next) {
      return fail(
        'wrong_window',
        `Not your turn yet — ${actionLabel(next.action)} for “${event.title}” runs from ${formatClock(
          next.start
        )} to ${formatClock(next.end)}.`
      );
    }
    return fail('ended', `No open scanning window for “${event.title}” right now.`);
  }

  // Step 6 — duplicate check for this specific window slot
  const { data: existingScan } = await supabase
    .from('attendance_scans')
    .select('id')
    .eq('student_id', studentId)
    .eq('event_id', event.id)
    .eq('slot', active.slot)
    .maybeSingle();

  if (existingScan) {
    return fail(
      'duplicate',
      `You already ${active.action === 'check_out' ? 'checked out' : 'checked in'} for this window (${formatClock(
        active.start
      )} – ${formatClock(active.end)}).`
    );
  }

  // Step 7 — attendance summary row (UNIQUE(student_id, event_id) + trigger guard)
  let attendanceId: string;
  let status: AttendanceStatus = 'present';

  const { data: existingAttendance } = await supabase
    .from('attendance')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('event_id', event.id)
    .maybeSingle();

  if (existingAttendance) {
    attendanceId = existingAttendance.id;
    status = (existingAttendance.status as AttendanceStatus) ?? 'present';
  } else {
    // auto-late: the first scan after the scheduled event start counts as late
    const eventStartMs = event.start_time ? Date.parse(event.start_time) : NaN;
    const initialStatus: AttendanceStatus =
      !Number.isNaN(eventStartMs) && now > eventStartMs ? 'late' : 'present';

    const { data: inserted, error } = await supabase
      .from('attendance')
      .insert([
        {
          student_id: studentId,
          event_id: event.id,
          attended_date: toLocalDateString(new Date()),
          status: initialStatus,
        },
      ])
      .select('id, recorded_at, status')
      .single();

    if (error || !inserted) {
      if (error?.code === '23505') {
        return fail('duplicate', `You already recorded attendance for “${event.title}”.`);
      }
      if (error?.code === '42501') {
        return fail('unauthorized', 'You are not authorized to record attendance.');
      }
      if (error?.code === 'P0001' || /CLOSED/i.test(error?.message ?? '')) {
        return fail('closed', `“${event.title}” is closed. Attendance can no longer be recorded.`);
      }
      return fail('db_error', error?.message ?? 'Could not record attendance.');
    }

    attendanceId = inserted.id;
    status = (inserted.status as AttendanceStatus) ?? initialStatus;
  }

  // Step 8 — record the individual check-in / check-out scan for this slot
  const { error: scanError } = await supabase.from('attendance_scans').insert([
    {
      attendance_id: attendanceId,
      student_id: studentId,
      event_id: event.id,
      slot: active.slot,
      action: active.action,
    },
  ]);

  if (scanError) {
    if (scanError.code === '23505') {
      return fail('duplicate', `You already scanned this window for “${event.title}”.`);
    }
    if (scanError.code === '42501') {
      return fail('unauthorized', 'You are not authorized to record attendance.');
    }
    if (scanError.code === 'P0001' || /closed/i.test(scanError.message ?? '')) {
      return fail('closed', `“${event.title}” is closed. Attendance can no longer be recorded.`);
    }
    return fail('db_error', scanError.message ?? 'Could not record the scan.');
  }

  return {
    ok: true,
    event: {
      title: event.title,
      venue: event.venue,
      eventCode: event.event_code,
    },
    recordedAt: new Date().toISOString(),
    status,
    action: active.action,
    slot: active.slot,
    windowStart: active.start,
    windowEnd: active.end,
  };
}

export type StudentAttendanceRecord = {
  id: string;
  eventCode: string;
  eventTitle: string;
  venue: string | null;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  eventStatus: string | null;
  attendedDate: string | null;
  recordedAt: string;
  status: AttendanceStatus;
};

/** A student's own attendance history (RLS also restricts to their rows). */
export async function getAttendanceHistory(
  studentId: string
): Promise<StudentAttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(
      `id, recorded_at, attended_date, status,
       events ( event_code, title, venue, event_date, start_time, end_time, status )`
    )
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    eventCode: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? 'Unknown event',
    venue: row.events?.venue ?? null,
    eventDate: row.events?.event_date ?? null,
    startTime: row.events?.start_time ?? null,
    endTime: row.events?.end_time ?? null,
    eventStatus: row.events?.status ?? null,
    attendedDate: row.attended_date ?? null,
    recordedAt: row.recorded_at,
    status: (row.status as AttendanceStatus) ?? 'present',
  }));
}

export type AttendeeRecord = {
  attendanceId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentNo: string | null;
  recordedAt: string;
  status: AttendanceStatus;
};

export type EventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  venue: string | null;
  startTime: string | null;
  endTime: string | null;
  eventStatus: string;
  target: EventTarget | null;
  /** How many students this event targets (denominator for rates). */
  expected: number;
  attendeeCount: number;
  attendees: AttendeeRecord[];
};

export type ProfilesMapEntry = {
  full_name: string | null;
  email: string | null;
  student_no: string | null;
  role: string | null;
  education: string | null;
  department: string | null;
  year_level: string | null;
  block: string | null;
  strand: string | null;
  grade_level: string | null;
  section: string | null;
};

async function fetchProfilesMapSafe(): Promise<Record<string, ProfilesMapEntry>> {
  const { data } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, student_no, role, education, department, year_level, block, strand, grade_level, section'
    );
  const map: Record<string, ProfilesMapEntry> = {};
  (data ?? []).forEach((row: any) => {
    map[row.id] = row;
  });
  return map;
}

/**
 * Teacher: attendance for events THEY created.
 * Admin (ownerId = null): attendance for every event.
 * Both are enforced a second time by RLS.
 */
export async function getEventAttendance(ownerId?: string | null): Promise<EventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, venue, start_time, end_time, status, created_by, target')
    .order('created_at', { ascending: false });

  if (eventError || !events) return [];

  const scoped = ownerId ? events.filter((e: any) => e.created_by === ownerId) : events;
  if (scoped.length === 0) return [];

  const eventIds = scoped.map((e: any) => e.id);

  const { data: rows, error: attError } = await supabase
    .from('attendance')
    .select('id, student_id, recorded_at, status, event_id')
    .in('event_id', eventIds)
    .order('recorded_at', { ascending: false });

  const attendanceRows = attError || !rows ? [] : rows;
  const profiles = await fetchProfilesMapSafe();

  return (scoped as any[])
    .map((event) => {
      const mine = attendanceRows.filter((row: any) => row.event_id === event.id);
      const target = parseEventTarget(event.target);

      // expected = students this event targets (denominator for present/absent %)
      const expected = Object.values(profiles).filter(
        (p) =>
          p.role === 'student' &&
          eventMatchesProfile(target, { ...p, role: p.role })
      ).length;

      return {
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        venue: event.venue ?? null,
        startTime: event.start_time,
        endTime: event.end_time,
        eventStatus: event.status ?? 'open',
        target,
        expected: Math.max(expected, mine.length),
        attendeeCount: mine.length,
        attendees: mine.map((row: any) => ({
          attendanceId: row.id,
          studentId: row.student_id,
          studentName: profiles[row.student_id]?.full_name ?? 'Unnamed student',
          studentEmail: profiles[row.student_id]?.email ?? '',
          studentNo: profiles[row.student_id]?.student_no ?? null,
          recordedAt: row.recorded_at,
          status: (row.status as AttendanceStatus) ?? 'present',
        })),
      };
    })
    .sort(
      (a, b) => new Date(b.startTime ?? 0).getTime() - new Date(a.startTime ?? 0).getTime()
    );
}

export type OverallRecord = AttendeeRecord & {
  eventId: string;
  eventCode: string;
  eventTitle: string;
  eventStatus: string;
  attendedDate: string | null;
};

/** Admin: every attendance row in the system, newest first. */
export async function getAllAttendance(): Promise<OverallRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(
      `id, student_id, recorded_at, attended_date, status, event_id,
       events ( id, event_code, title, status )`
    )
    .order('recorded_at', { ascending: false })
    .limit(300);

  if (error || !data) return [];

  const profiles = await fetchProfilesMapSafe();

  return (data as any[]).map((row) => ({
    attendanceId: row.id,
    studentId: row.student_id,
    studentName: profiles[row.student_id]?.full_name ?? 'Unnamed student',
    studentEmail: profiles[row.student_id]?.email ?? '',
    studentNo: profiles[row.student_id]?.student_no ?? null,
    recordedAt: row.recorded_at,
    attendedDate: row.attended_date ?? null,
    status: (row.status as AttendanceStatus) ?? 'present',
    eventId: row.events?.id ?? '',
    eventCode: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? 'Unknown event',
    eventStatus: row.events?.status ?? 'open',
  }));
}

export type SystemSummary = {
  totalEvents: number;
  openEvents: number;
  totalRecords: number;
  studentCount: number;
  teacherCount: number;
  adminCount: number;
};

async function countRows(
  table: 'events' | 'attendance' | 'profiles',
  filter?: { column: string; value: string }
): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count } = await q;
  return count ?? 0;
}

/** Admin dashboard numbers (exact counts via head queries). */
export async function getSystemSummary(): Promise<SystemSummary> {
  const [totalEvents, openEvents, totalRecords, students, teachers, admins] =
    await Promise.all([
      countRows('events'),
      countRows('events', { column: 'status', value: 'open' }),
      countRows('attendance'),
      countRows('profiles', { column: 'role', value: 'student' }),
      countRows('profiles', { column: 'role', value: 'teacher' }),
      countRows('profiles', { column: 'role', value: 'admin' }),
    ]);

  return {
    totalEvents,
    openEvents,
    totalRecords,
    studentCount: students,
    teacherCount: teachers,
    adminCount: admins,
  };
}

/** Staff summary for the home screen (teacher: own events, admin: all). */
export async function getStaffSummary(ownerId?: string | null): Promise<{
  totalEvents: number;
  openEvents: number;
  totalCheckIns: number;
}> {
  let q = supabase.from('events').select('id, status');
  if (ownerId) q = q.eq('created_by', ownerId);
  const { data: events } = await q;
  const rows = events ?? [];

  const ids = rows.map((e: any) => e.id);
  let checkIns = 0;
  if (ids.length > 0) {
    const { count } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .in('event_id', ids);
    checkIns = count ?? 0;
  }

  return {
    totalEvents: rows.length,
    openEvents: rows.filter((e: any) => e.status === 'open').length,
    totalCheckIns: checkIns,
  };
}

/** Student summary for the home screen. */
export async function getStudentSummary(studentId: string): Promise<{
  totalAttended: number;
  openEvents: number;
}> {
  const [{ count: attended }, { count: open }] = await Promise.all([
    supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  return { totalAttended: attended ?? 0, openEvents: open ?? 0 };
}

/** Admin: correct an attendance record's status (present/late/absent). */
export async function correctAttendance(
  attendanceId: string,
  status: AttendanceStatus
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('attendance')
    .update({ status, corrected_by: user?.id ?? null })
    .eq('id', attendanceId);

  return { error: error?.message ?? null };
}

/** Admin: remove an incorrect attendance record. */
export async function deleteAttendance(attendanceId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('attendance').delete().eq('id', attendanceId);
  return { error: error?.message ?? null };
}

/**
 * Realtime subscription on the attendance table.
 * INSERT/UPDATE/DELETE → callback (used to refresh monitors live).
 * Optionally restricted to a set of event ids (teacher's own events).
 */
export function watchAttendance(
  onChange: () => void,
  eventIds?: string[] | null
): () => void {
  const channel = supabase
    .channel(`attendance-watch-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance' },
      (payload: any) => {
        if (eventIds && eventIds.length > 0) {
          const row = payload.new?.event_id ? payload.new : payload.old;
          if (!row?.event_id || !eventIds.includes(row.event_id)) return;
        }
        onChange();
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      // channel already removed
    }
  };
}

// ============================================================
// ATTENDANCE SUMMARIES / RATES (student history, staff reports)
// ============================================================

export type StudentStats = {
  /** Attendance rate: attended / scheduled targeted events × 100. */
  rate: number;
  present: number;
  late: number;
  absent: number;
  attended: number;
  scheduled: number;
};

/**
 * A student's personal attendance statistics:
 *  • present/late/absent come from their attendance rows
 *  • scheduled = events targeted at them (event target matching)
 *  • absent    = targeted events they never attended (+ rows marked absent)
 *  • rate      = attended / scheduled
 */
export async function getStudentStats(studentId: string): Promise<StudentStats> {
  const [rowsResult, profile, events] = await Promise.all([
    supabase.from('attendance').select('status').eq('student_id', studentId),
    getProfile(studentId),
    listEvents(),
  ]);

  const rows = rowsResult.data ?? [];
  const present = rows.filter((r: any) => r.status === 'present').length;
  const late = rows.filter((r: any) => r.status === 'late').length;
  const absentMarked = rows.filter((r: any) => r.status === 'absent').length;
  const attended = present + late;

  const scheduled =
    events.filter((e) => eventMatchesProfile(e.target, profile)).length || rows.length;
  const absent = Math.max(scheduled - attended, absentMarked, 0);
  const rate = scheduled > 0 ? Math.round((attended / scheduled) * 100) : 0;

  return { rate, present, late, absent, attended, scheduled };
}

export type EventSummary = {
  present: number;
  late: number;
  absent: number;
  /** attended (present + late) — the "recorded" students */
  recorded: number;
  /** expected students for this event (target audience) */
  expected: number;
  /** present rate % = recorded / expected */
  rate: number;
};

/** Present / late / absent counts + percentage for one event. */
export function summarizeEvent(
  attendees: AttendeeRecord[],
  expected: number
): EventSummary {
  const present = attendees.filter((a) => a.status === 'present').length;
  const late = attendees.filter((a) => a.status === 'late').length;
  const recorded = present + late;
  const denominator = Math.max(expected, attendees.length, recorded);
  const absent = Math.max(denominator - recorded, 0);
  const rate = denominator > 0 ? Math.round((recorded / denominator) * 100) : 0;
  return { present, late, absent, recorded, expected: denominator, rate };
}

export type StudentScan = {
  attendanceId: string;
  slot: number;
  action: ScanAction;
  scannedAt: string;
};

/** One student's check-in / check-out timeline, grouped per attendance row. */
export async function getStudentScans(
  studentId: string
): Promise<Record<string, StudentScan[]>> {
  const { data } = await supabase
    .from('attendance_scans')
    .select('attendance_id, slot, action, scanned_at')
    .eq('student_id', studentId)
    .order('slot', { ascending: true });

  const map: Record<string, StudentScan[]> = {};
  (data ?? []).forEach((row: any) => {
    const key = row.attendance_id as string;
    if (!map[key]) map[key] = [];
    map[key].push({
      attendanceId: key,
      slot: row.slot ?? 0,
      action: (row.action as ScanAction) ?? 'check_in',
      scannedAt: row.scanned_at,
    });
  });
  return map;
}

export type OverallReport = {
  students: number;
  attended: number;
  late: number;
  absent: number;
  /** present rate % over all students */
  rate: number;
  /** raw attendance row counts */
  presentRows: number;
  lateRows: number;
  absentRows: number;
  totalRows: number;
};

/**
 * Admin: overall system attendance — how many students attended at least one
 * event, how many are absent, plus the raw present/late/absent row counts.
 */
export async function getOverallReport(): Promise<OverallReport> {
  const [students, rowsResult] = await Promise.all([
    listProfiles().then((ps) => ps.filter((p) => p.role === 'student')),
    supabase.from('attendance').select('student_id, status'),
  ]);

  const rows = rowsResult.data ?? [];
  const byStudent: Record<string, string[]> = {};
  rows.forEach((row: any) => {
    if (!byStudent[row.student_id]) byStudent[row.student_id] = [];
    byStudent[row.student_id].push(row.status);
  });

  let attended = 0;
  let late = 0;
  students.forEach((s) => {
    const statuses = byStudent[s.id] ?? [];
    if (statuses.some((st) => st !== 'absent')) {
      attended += 1;
      if (statuses.includes('late')) late += 1;
    }
  });

  const presentRows = rows.filter((r: any) => r.status === 'present').length;
  const lateRows = rows.filter((r: any) => r.status === 'late').length;
  const absentRows = rows.filter((r: any) => r.status === 'absent').length;

  return {
    students: students.length,
    attended,
    late,
    absent: Math.max(students.length - attended, 0),
    rate: students.length > 0 ? Math.round((attended / students.length) * 100) : 0,
    presentRows,
    lateRows,
    absentRows,
    totalRows: rows.length,
  };
}

export type GroupRate = {
  group: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  /** present % over the group */
  rate: number;
  /** absent % over the group */
  absentRate: number;
};

/**
 * Department / education-level breakdown:
 * "how many students from a department are present" as present vs absent %.
 */
export async function getDepartmentRates(): Promise<GroupRate[]> {
  const [students, rowsResult] = await Promise.all([
    listProfiles().then((ps) => ps.filter((p) => p.role === 'student')),
    supabase.from('attendance').select('student_id, status'),
  ]);

  const rows = rowsResult.data ?? [];
  const byStudent: Record<string, string[]> = {};
  rows.forEach((row: any) => {
    if (!byStudent[row.student_id]) byStudent[row.student_id] = [];
    byStudent[row.student_id].push(row.status);
  });

  const groups: Record<string, { total: number; present: number; late: number }> = {};

  students.forEach((p: Profile) => {
    const key = p.department || educationLabel(p.education) || 'Unassigned';
    if (!groups[key]) groups[key] = { total: 0, present: 0, late: 0 };
    groups[key].total += 1;

    const statuses = byStudent[p.id] ?? [];
    if (statuses.some((st) => st !== 'absent')) {
      groups[key].present += 1;
      if (statuses.includes('late')) groups[key].late += 1;
    }
  });

  return Object.entries(groups)
    .map(([group, g]) => ({
      group,
      total: g.total,
      present: g.present,
      late: g.late,
      absent: Math.max(g.total - g.present, 0),
      rate: g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
      absentRate: g.total > 0 ? Math.round(((g.total - g.present) / g.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}