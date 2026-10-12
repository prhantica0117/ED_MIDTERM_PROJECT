import type { EventTarget, EducationInfo } from '../constants/education';
import { supabase } from './supabase';

export type EventStatus = 'open' | 'closed';
export type EventType = 'event' | 'class';
export type ScanAction = 'check_in' | 'check_out';

/** One check-in / check-out window (absolute ISO timestamps). */
export type ScanWindow = {
  slot: number;
  action: ScanAction;
  start: string;
  end: string;
};

/** Row shape of the public `events` table. */
export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  event_date: string | null; // YYYY-MM-DD
  start_time: string | null; // ISO timestamp
  end_time: string | null; // ISO timestamp
  venue: string | null;
  description: string | null;
  status: EventStatus;
  event_type: EventType;
  target: EventTarget | null;
  scan_windows: ScanWindow[] | null;
  created_by: string | null;
  created_at: string;
};

export type EventInput = {
  title: string;
  eventCode: string;
  venue: string;
  description: string;
  eventDate: string; // YYYY-MM-DD
  startsAtISO: string;
  endsAtISO: string;
  eventType?: EventType;
  target?: EventTarget;
  scanWindows?: ScanWindow[];
};

/** jsonb columns come back as objects — normalise safely. */
export function parseEventTarget(raw: unknown): EventTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const audiences = Array.isArray(obj.audiences) ? (obj.audiences as string[]) : ['all'];
  const classTarget = (obj.classTarget ?? null) as EducationInfo | null;
  return { audiences: audiences.length ? audiences : ['all'], classTarget };
}

/** jsonb scan_windows come back as [{slot, action, start, end}] — validate shape. */
export function parseScanWindows(raw: unknown): ScanWindow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object')
    .map((w, index) => ({
      slot: typeof w.slot === 'number' ? w.slot : index,
      action: w.action === 'check_out' ? ('check_out' as const) : ('check_in' as const),
      start: typeof w.start === 'string' ? w.start : '',
      end: typeof w.end === 'string' ? w.end : '',
    }))
    .filter((w) => w.start && w.end)
    .sort((a, b) => a.slot - b.slot);
}

function normalizeEventRow(row: any): CloudEvent {
  return {
    ...row,
    event_type: row.event_type === 'class' ? 'class' : 'event',
    target: parseEventTarget(row.target),
    scan_windows: parseScanWindows(row.scan_windows),
  };
}

function mapWriteError(message: string, code?: string): string {
  if (code === '23505') return 'That event code already exists. Pick a different one.';
  if (code === '42501') return 'You are not authorized to manage events.';
  if (code === '23514') return 'Event failed a database constraint. Check your inputs.';
  return message;
}

/** Create an event (teacher/admin). RLS forces created_by = current user. */
export async function createEvent(
  input: EventInput
): Promise<{ event: CloudEvent | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('events')
    .insert([
      {
        event_code: input.eventCode.trim().toUpperCase(),
        title: input.title.trim(),
        event_date: input.eventDate,
        start_time: input.startsAtISO,
        end_time: input.endsAtISO,
        venue: input.venue.trim(),
        description: input.description.trim() || null,
        status: 'open' as EventStatus,
        event_type: input.eventType ?? 'event',
        target: input.target ?? { audiences: ['all'] },
        scan_windows: input.scanWindows ?? [],
        created_by: user?.id ?? null,
      },
    ])
    .select('*')
    .single();

  if (error || !data) {
    return {
      event: null,
      error: mapWriteError(error?.message ?? 'Could not create the event.', error?.code),
    };
  }

  return { event: normalizeEventRow(data), error: null };
}

/** Edit an event's details (owner teacher or admin — enforced by RLS). */
export async function updateEvent(
  eventId: string,
  patch: Partial<EventInput> & { status?: EventStatus }
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.eventCode !== undefined) payload.event_code = patch.eventCode.trim().toUpperCase();
  if (patch.venue !== undefined) payload.venue = patch.venue.trim();
  if (patch.description !== undefined) payload.description = patch.description.trim() || null;
  if (patch.eventDate !== undefined) payload.event_date = patch.eventDate;
  if (patch.startsAtISO !== undefined) payload.start_time = patch.startsAtISO;
  if (patch.endsAtISO !== undefined) payload.end_time = patch.endsAtISO;
  if (patch.eventType !== undefined) payload.event_type = patch.eventType;
  if (patch.target !== undefined) payload.target = patch.target;
  if (patch.scanWindows !== undefined) payload.scan_windows = patch.scanWindows;
  if (patch.status !== undefined) payload.status = patch.status;

  const { error } = await supabase.from('events').update(payload).eq('id', eventId);

  if (error) return { error: mapWriteError(error.message, error.code) };
  return { error: null };
}

/** Close or reopen an event — this is what blocks attendance when closed. */
export async function setEventStatus(
  eventId: string,
  status: EventStatus
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('events').update({ status }).eq('id', eventId);
  if (error) return { error: mapWriteError(error.message, error.code) };
  return { error: null };
}

/** Delete an event (owner or admin — RLS decides). Attendance cascades. */
export async function deleteEvent(eventId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) return { error: mapWriteError(error.message, error.code) };
  return { error: null };
}

export type ListEventsOptions = {
  /** Teacher: only their events. Admin: omit to get every event. */
  createdBy?: string | null;
  status?: EventStatus | null;
  limit?: number;
};

/** List events with optional ownership/status filters (all roles can read). */
export async function listEvents(options: ListEventsOptions = {}): Promise<CloudEvent[]> {
  let query = supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (options.createdBy) query = query.eq('created_by', options.createdBy);
  if (options.status) query = query.eq('status', options.status);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as any[]).map(normalizeEventRow);
}

export async function getEventByCode(code: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code.trim().toUpperCase())
    .maybeSingle();

  if (error || !data) return null;
  return normalizeEventRow(data);
}

export async function getEventById(id: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return normalizeEventRow(data);
}

/** Auto-generated event code, e.g. EVT-2026-4F2K. */
export function generateEventCode(): string {
  const year = new Date().getFullYear();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `EVT-${year}-${suffix}`;
}

/**
 * Realtime: fires whenever any event row is inserted/updated/deleted
 * (e.g. a teacher closes an event → open lists refresh live).
 */
export function watchEvents(onChange: () => void): () => void {
  const channel = supabase
    .channel(`events-watch-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => onChange())
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      // channel already removed
    }
  };
}