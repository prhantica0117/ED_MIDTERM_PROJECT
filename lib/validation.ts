/**
 * Centralised input validation.
 * Every form in the app validates through these helpers so rules stay
 * consistent and demonstrable during the exam.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVENT_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Email is required.';
  if (!EMAIL_RE.test(value)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export function validateName(name: string, label = 'Name'): string | null {
  if (!name.trim()) return `${label} is required.`;
  if (name.trim().length < 2) return `${label} is too short.`;
  if (name.trim().length > 80) return `${label} is too long.`;
  return null;
}

export function validateEventCode(code: string): string | null {
  const value = code.trim().toUpperCase();
  if (!value) return 'Event code is required.';
  if (!EVENT_CODE_RE.test(value)) {
    return 'Use 3–32 characters: letters, numbers or dashes (e.g. EVT-2026-0001).';
  }
  return null;
}

export type EventFormInput = {
  title: string;
  eventCode: string;
  venue: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
};

/** Full event form validation (title, code, venue, times). */
export function validateEventForm(form: EventFormInput): string | null {
  if (!form.title.trim()) return 'Event name is required.';
  if (form.title.trim().length < 3) return 'Event name must be at least 3 characters.';

  const codeError = validateEventCode(form.eventCode);
  if (codeError) return codeError;

  if (!form.venue.trim()) return 'Venue is required.';
  if (form.venue.trim().length > 120) return 'Venue must be 120 characters or fewer.';
  if (form.description.trim().length > 500) return 'Description must be 500 characters or fewer.';

  if (isNaN(form.startsAt.getTime()) || isNaN(form.endsAt.getTime())) {
    return 'Valid start and end date/time are required.';
  }
  if (form.endsAt.getTime() <= form.startsAt.getTime()) {
    return 'End time must be after start time.';
  }
  return null;
}

/** Returns a local YYYY-MM-DD string for a Date. */
export function toLocalDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}