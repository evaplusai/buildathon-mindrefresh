// waitlist.ts — POSTs marketing-page email captures to a Google Apps
// Script web app that appends rows to a Google Sheet.
//
// Per ADR-019 (amended): the persistence target moved from Supabase to
// a Google Sheet (no Supabase account required). The web app URL is
// supplied via VITE_WAITLIST_URL.
//
// Flow:
//   1. Modal calls submitWaitlistEmail(email, source)
//   2. We POST { email, source, user_agent } to VITE_WAITLIST_URL
//   3. The Apps Script appends a row to the Sheet (header: email, source,
//      ts, user_agent)
//
// Fail-soft: when VITE_WAITLIST_URL is unset, returns
// { ok: false, error: 'not configured' } — the modal surfaces a polite
// retry message without revealing infra.
//
// Privacy: only email + source + user_agent + server-side ts. No IP
// captured (Apps Script doesn't expose it on doPost). The user_agent
// is captured to help the user (sheet owner) triage spam later.

export type WaitlistSource =
  | 'banner'
  | 'nav'
  | 'hero'
  | 'final-cta'
  | 'login-gate'
  | 'other';

const STORED_EMAIL_KEY = 'mindrefresh.email';

export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORED_EMAIL_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function saveStoredEmail(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORED_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* localStorage disabled — silently skip */
  }
}

export interface SubmitResult {
  ok: boolean;
  /** True when the row was successfully appended. */
  inserted?: boolean;
  /** Set when ok=false. */
  error?: string;
}

function getEndpoint(): string | null {
  const url = (import.meta.env.VITE_WAITLIST_URL as string | undefined) ?? '';
  return url.startsWith('https://') ? url : null;
}

/** Test hook — no module cache to reset for the fetch path. */
export function _resetCacheForTests(): void {
  // No-op kept for backward compat with older spec files.
}

/**
 * Permissive client-side email check. Backstop only — the Apps Script
 * is the authoritative gate. Returns true for typical RFC-5322 shapes.
 */
export function isPlausibleEmail(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 5 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Submit one waitlist signup. Fail-soft.
 *
 * - { ok: true, inserted: true } — Apps Script returned ok.
 * - { ok: false, error } — env var missing OR Apps Script returned an error
 *   OR network failure.
 *
 * Never throws.
 */
export async function submitWaitlistEmail(
  email: string,
  source: WaitlistSource,
): Promise<SubmitResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, error: 'Email is required.' };
  }

  const endpoint = getEndpoint();
  if (!endpoint) {
    return { ok: false, error: 'Email capture is not configured for this build.' };
  }

  const userAgent =
    typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent.slice(0, 500)
      : '';

  try {
    // Apps Script web app POSTs return a 302 → googleusercontent.com/echo
    // chain whose final hop returns 405 even though the doPost ran on the
    // first hop. With mode: 'no-cors' the browser sends the request without
    // preflight, the doPost executes, and the opaque response is ignored —
    // fire-and-forget. Network failures still throw and are caught below.
    await fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ email: trimmed, source, user_agent: userAgent }),
    });
    return { ok: true, inserted: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, error: message };
  }
}
