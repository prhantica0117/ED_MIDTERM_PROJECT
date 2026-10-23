export type QRPayload = {
  v: 1;
  event: string;
  title?: string;
  start?: string;
  end?: string;
  /** TOTP time window (30-second slots). Optional for backward compatibility. */
  window?: number;
};

/** 30-second TOTP window length in seconds. */
export const TOTP_WINDOW_SECONDS = 30;

/** Interval in ms between TOTP rotations (30 seconds). */
export const TOTP_INTERVAL_MS = 30_000;

/**
 * Current TOTP time window: floor(epoch_seconds / 30).
 * Rotates every 30 seconds.
 */
export function getCurrentWindow(): number {
  return Math.floor(Date.now() / 1000 / TOTP_WINDOW_SECONDS);
}

/** Previous TOTP window (currentWindow - 1) for latency/clock-skew tolerance. */
export function getPreviousWindow(): number {
  return getCurrentWindow() - 1;
}

/**
 * Returns true if the given window is the current or previous TOTP window.
 * Allows ~60 seconds of tolerance for network latency and clock skew.
 */
export function isValidWindow(window: number): boolean {
  const current = getCurrentWindow();
  return window === current || window === current - 1;
}

/** Seconds remaining until the current TOTP window rotates. */
export function secondsUntilNextRotation(): number {
  const now = Date.now();
  const currentWindowStartMs = getCurrentWindow() * TOTP_WINDOW_SECONDS * 1000;
  const nextRotationMs = currentWindowStartMs + TOTP_WINDOW_SECONDS * 1000;
  return Math.max(0, Math.ceil((nextRotationMs - now) / 1000));
}

export function buildQRPayload(event: {
  eventId: string;
  title: string;
  start?: string;
  end?: string;
}): string {
  const payload: QRPayload = {
    v: 1,
    event: event.eventId,
  };

  if (event.title) payload.title = event.title;
  if (event.start) payload.start = event.start;
  if (event.end) payload.end = event.end;

  return JSON.stringify(payload);
}

/**
 * Build a TOTP-enabled QR payload that includes the current 30-second
 * time window. The server verifies the window is current or previous.
 */
export function buildTOTPQRPayload(event: {
  eventId: string;
  title: string;
  start?: string;
  end?: string;
}): string {
  const payload: QRPayload = {
    v: 1,
    event: event.eventId,
    window: getCurrentWindow(),
  };

  if (event.title) payload.title = event.title;
  if (event.start) payload.start = event.start;
  if (event.end) payload.end = event.end;

  return JSON.stringify(payload);
}

export type ParseQRResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; message: string };

export function parseQRPayload(raw: string): ParseQRResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Invalid QR code.' };
  }

  if (parsed.v !== 1 || typeof parsed.event !== 'string' || !parsed.event) {
    return { ok: false, message: 'Not an attendance QR code.' };
  }

  return { ok: true, payload: parsed as QRPayload };
}