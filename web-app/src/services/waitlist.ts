// waitlist.ts — submits a marketing-page email capture to Supabase.
//
// Per ADR-019 §D: anon-key writes to `waitlist_signups`. Fail-soft: when
// the env vars are missing OR the network is unavailable, the function
// resolves to `{ ok: false, error }` and the caller surfaces a polite
// retry. We do NOT throw to the UI.
//
// Privacy: the only field we capture is the email itself plus an enum
// `source` value. No IP, no UA, no referrer captured at the SDK level.
// (Supabase's standard headers travel; we don't add tracking.)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type WaitlistSource =
  | 'banner'
  | 'nav'
  | 'hero'
  | 'final-cta'
  | 'other';

export interface SubmitResult {
  ok: boolean;
  /** Set when ok=true and the (email, source) row was inserted. */
  inserted?: boolean;
  /** Set when ok=false. Human-readable message safe to show in UI. */
  error?: string;
}

let cached: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

/** Reset the cached Supabase client. Test-only. */
export function _resetCacheForTests(): void {
  cached = undefined;
}

/**
 * Insert one waitlist signup row. Fail-soft.
 *
 * - Resolves to `{ ok: true, inserted: true }` on a fresh insert.
 * - Resolves to `{ ok: true, inserted: false }` when the (email, source)
 *   row already exists (the unique constraint fires; treat as success
 *   because the user's intent was honoured).
 * - Resolves to `{ ok: false, error }` on transport / config failure.
 */
export async function submitWaitlistEmail(
  email: string,
  source: WaitlistSource,
): Promise<SubmitResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, error: 'Email is required.' };
  }

  const client = getClient();
  if (!client) {
    // Env vars missing — degrade silently but report the cause for tests.
    return { ok: false, error: 'Email capture is not configured for this build.' };
  }

  try {
    const { error } = await client
      .from('waitlist_signups')
      .insert([{ email: trimmed, source }]);

    if (!error) {
      return { ok: true, inserted: true };
    }

    // Unique constraint conflict — treat as success (we already have it).
    // Postgres code 23505 = unique_violation.
    if (
      error.code === '23505' ||
      /duplicate key|unique constraint/i.test(error.message ?? '')
    ) {
      return { ok: true, inserted: false };
    }

    return { ok: false, error: error.message ?? 'Insert failed.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

/**
 * Permissive client-side email check. Backstop only — the server-side
 * insert is the authoritative gate. Returns true for typical RFC-5322
 * shapes; doesn't try to be exhaustive.
 */
export function isPlausibleEmail(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 5 || v.length > 254) return false;
  // local@host.tld minimal shape
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
