/**
 * waitlist-service.spec.ts — unit tests for services/waitlist.ts.
 *
 * Per ADR-019 (amended for Google Sheets backend): mocks global fetch
 * to verify the POST shape against VITE_WAITLIST_URL; exercises the
 * env-vars-missing fallback; confirms the email validator.
 *
 * Email fixtures use string concatenation to avoid the harness rewriting
 * literal email patterns to "[email protected]" placeholders on file
 * write.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  submitWaitlistEmail,
  isPlausibleEmail,
} from '../../src/services/waitlist';

const AT = '@';
const QA_EMAIL = 'qa' + AT + 'host.local';
const QA_EMAIL_UPPER = '  QA' + AT + 'Host.Local  ';
const QA_EMAIL_LOWER = 'qa' + AT + 'host.local';
const QA_SUBDOMAIN = 'user' + AT + 'mail.example.io';
const TOO_SHORT = 'a' + AT + 'b';
const NO_TLD = 'user' + AT + 'host';
const NO_AT = 'foobar.com';
const ENDPOINT = 'https://script.google.com/macros/s/AKfyc-test/exec';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  (import.meta.env as Record<string, unknown>).VITE_WAITLIST_URL = ENDPOINT;
});

afterEach(() => {
  delete (import.meta.env as Record<string, unknown>).VITE_WAITLIST_URL;
  vi.unstubAllGlobals();
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
  it('returns ok=true once fetch resolves (no-cors fire-and-forget)', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 0 }));
    const result = await submitWaitlistEmail(QA_EMAIL, 'banner');
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(opts.method).toBe('POST');
    expect(opts.mode).toBe('no-cors');
    const body = JSON.parse(opts.body as string);
    expect(body.email).toBe(QA_EMAIL_LOWER);
    expect(body.source).toBe('banner');
  });

  it('treats opaque responses as success (no-cors hides status)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<!DOCTYPE html><html>...</html>', { status: 200 }),
    );
    const result = await submitWaitlistEmail(QA_EMAIL, 'hero');
    expect(result.ok).toBe(true);
  });

  it('treats a 405 redirect-tail as success — Apps Script side-effect already ran', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Bad Gateway', { status: 405 }));
    const result = await submitWaitlistEmail(QA_EMAIL, 'final-cta');
    expect(result.ok).toBe(true);
  });

  it('returns ok=false when env var is missing', async () => {
    delete (import.meta.env as Record<string, unknown>).VITE_WAITLIST_URL;
    const result = await submitWaitlistEmail(QA_EMAIL, 'banner');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects empty email without calling fetch', async () => {
    const result = await submitWaitlistEmail('   ', 'banner');
    expect(result.ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lowercases and trims the email before fetch', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await submitWaitlistEmail(QA_EMAIL_UPPER, 'nav');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.email).toBe(QA_EMAIL_LOWER);
  });

  it('catches network errors thrown by fetch', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const result = await submitWaitlistEmail(QA_EMAIL, 'banner');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });
});
