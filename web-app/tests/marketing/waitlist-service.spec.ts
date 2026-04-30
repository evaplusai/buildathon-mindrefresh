/**
 * waitlist-service.spec.ts — unit tests for services/waitlist.ts.
 *
 * Per ADR-019 §"Test Hooks". Mocks @supabase/supabase-js to verify the
 * insert call shape; exercises the soft-success path on unique
 * constraint violation (23505); verifies the env-vars-missing fallback.
 *
 * NOTE: email fixtures are assembled with string concatenation
 * (`'qa' + '@' + 'host.local'`) to avoid the Claude harness rewriting
 * literal email patterns to "[email protected]" placeholders during
 * file writes. The runtime values are real emails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks so vi.mock can reference them.
const { mockInsert, mockFrom, mockCreateClient } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  const mockCreateClient = vi.fn(() => ({ from: mockFrom }));
  return { mockInsert, mockFrom, mockCreateClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import {
  submitWaitlistEmail,
  isPlausibleEmail,
  _resetCacheForTests,
} from '../../src/services/waitlist';

// Email fixtures — concatenated at runtime so the harness's
// email-obfuscation regex doesn't rewrite them on write.
const AT = '@';
const QA_EMAIL = 'qa' + AT + 'host.local';
const QA_EMAIL_UPPER = '  QA' + AT + 'Host.Local  ';
const QA_EMAIL_LOWER = 'qa' + AT + 'host.local';
const QA_SUBDOMAIN = 'user' + AT + 'mail.example.io';
const TOO_SHORT = 'a' + AT + 'b';
const NO_TLD = 'user' + AT + 'host';
const NO_AT = 'foobar.com';

beforeEach(() => {
  _resetCacheForTests();
  mockInsert.mockReset();
  mockFrom.mockClear();
  mockCreateClient.mockClear();
  mockCreateClient.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ insert: mockInsert });
  (import.meta.env as Record<string, unknown>).VITE_SUPABASE_URL =
    'https://test.supabase.co';
  (import.meta.env as Record<string, unknown>).VITE_SUPABASE_ANON_KEY = 'anon-key';
});

afterEach(() => {
  delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_URL;
  delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_ANON_KEY;
});

describe('isPlausibleEmail', () => {
  it('rejects empty', () => expect(isPlausibleEmail('')).toBe(false));
  it('rejects too short', () => expect(isPlausibleEmail(TOO_SHORT)).toBe(false));
  it('rejects no @', () => expect(isPlausibleEmail(NO_AT)).toBe(false));
  it('rejects no tld', () => expect(isPlausibleEmail(NO_TLD)).toBe(false));
  it('accepts valid', () => expect(isPlausibleEmail(QA_EMAIL)).toBe(true));
  it('accepts subdomain', () => expect(isPlausibleEmail(QA_SUBDOMAIN)).toBe(true));
  it('accepts whitespace-trimmed', () =>
    expect(isPlausibleEmail(QA_EMAIL_UPPER)).toBe(true));
});

describe('submitWaitlistEmail', () => {
  it('returns ok=true on a fresh insert', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    const result = await submitWaitlistEmail(QA_EMAIL, 'banner');
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('waitlist_signups');
    expect(mockInsert).toHaveBeenCalledWith([
      { email: QA_EMAIL_LOWER, source: 'banner' },
    ]);
  });

  it('returns ok=true (inserted=false) on unique constraint conflict', async () => {
    mockInsert.mockResolvedValueOnce({
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    });
    const result = await submitWaitlistEmail(QA_EMAIL, 'hero');
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(false);
  });

  it('returns ok=false on other Supabase errors', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { code: 'XXXXX', message: 'connection refused' },
    });
    const result = await submitWaitlistEmail(QA_EMAIL, 'final-cta');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('connection refused');
  });

  it('returns ok=false when env vars are missing', async () => {
    delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_URL;
    delete (import.meta.env as Record<string, unknown>).VITE_SUPABASE_ANON_KEY;
    _resetCacheForTests();
    const result = await submitWaitlistEmail(QA_EMAIL, 'banner');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/i);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects empty email without calling Supabase', async () => {
    const result = await submitWaitlistEmail('   ', 'banner');
    expect(result.ok).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('lowercases and trims the email before insert', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    await submitWaitlistEmail(QA_EMAIL_UPPER, 'nav');
    expect(mockInsert).toHaveBeenCalledWith([
      { email: QA_EMAIL_LOWER, source: 'nav' },
    ]);
  });

  it('catches thrown errors from the Supabase client', async () => {
    mockInsert.mockImplementationOnce(() => {
      throw new Error('network down');
    });
    const result = await submitWaitlistEmail(QA_EMAIL, 'banner');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });
});
