import { getEventByCode, type CloudEvent } from './events';
import { getProfile } from './profiles';
import { parseQRPayload } from './qr';
import { supabase } from './supabase';
import { toLocalDateString } from './validation';

export type AttendanceStatus = 'present' | 'late' | 'absent';

/** Machine-readable failure reasons so the UI can give tailored feedback. */
export type ScanFailureCode =
  | 'invalid_qr'
  | 'event_missing'
  | 'closed'
  | 'not_started'
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
    }
  | { ok: false; code: ScanFailureCode; message: string };

function fail(code: ScanFailureCode, message: string): ScanResult {
  return { ok: false, code, message };
}

/**
 * QR attendance pipeline (event → handler → action → result):
 *  1. Parse/validate the QR payload            → invalid_qr
 *  2. Authorization: only students may record  → unauthorized
 *  3. Look the event up in the database        → event_missing (invalid QR)
 *  4. Event status must be "open"              → closed
 *  5. Current time must be inside the window   → not_started / ended
 *  6. Duplicate check (pre-query + UNIQUE)     → duplicate
 *  7. Insert row (RLS + DB trigger guard)      → success / db_error
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

  // Step 4 — closed events reject attendance
  if (event.status !== 'open') {
    return fail('closed', `“${event.title}” is closed. Attendance can no longer be recorded.`);
  }

  // Step 5 — time window (source of truth = database, not the QR image)
  const now = Date.now();
  const startMs = event.start_time ? Date.parse(event.start_time) : NaN;
  const endMs = event.end_time ? Date.parse(event.end_time) : NaN;

  if (!Number.isNaN(startMs) && now < startMs) {
    return fail('not_started', `“${event.title}” has not started yet.`);
  }
  if (!Number.isNaN(endMs) && now > endMs) {
    return fail('ended', `“${event.title}” has already ended.`);
  }

  // Step 6 — duplicate attendance pre-check
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('student_id', studentId)
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing) {
    return fail('duplicate', `You already recorded attendance for “${event.title}”.`);
  }

  // Step 7 — record attendance (UNIQUE(student_id, event_id) + trigger guard)
  const { data: inserted, error } = await supabase
    .from('attendance')
    .insert([
      {
        student_id: studentId,
        event_id: event.id,
        attended_date: toLocalDateString(new Date()),
        status: 'present' as AttendanceStatus,
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

  return {
    ok: true,
    event: {
      title: event.title,
      venue: event.venue,
      eventCode: event.event_code,
    },
    recordedAt: inserted.recorded_at ?? new Date().toISOString(),
    status: (inserted.status as AttendanceStatus) ?? 'present',
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
  attendeeCount: number;
  attendees: AttendeeRecord[];
};

async function fetchProfilesMapSafe(): Promise<
  Record<string, { full_name: string | null; email: string | null }>
> {
  const { data } = await supabase.from('profiles').select('id, full_name, email');
  const map: Record<string, { full_name: string | null; email: string | null }> = {};
  (data ?? []).forEach((row: any) => {
    map[row.id] = { full_name: row.full_name, email: row.email };
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
    .select('id, event_code, title, venue, start_time, end_time, status, created_by')
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
      return {
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        venue: event.venue ?? null,
        startTime: event.start_time,
        endTime: event.end_time,
        eventStatus: event.status ?? 'open',
        attendeeCount: mine.length,
        attendees: mine.map((row: any) => ({
          attendanceId: row.id,
          studentId: row.student_id,
          studentName: profiles[row.student_id]?.full_name ?? 'Unnamed student',
          studentEmail: profiles[row.student_id]?.email ?? '',
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