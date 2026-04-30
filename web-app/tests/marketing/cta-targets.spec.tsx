/**
 * cta-targets.spec.ts
 *
 * Vitest + React Testing Library.
 * Renders <MarketingLanding /> inside a MemoryRouter and asserts CTA
 * wiring rules from ADR-012 + ADR-014 + DDD-05 §Invariants 5.
 *
 * Run order:
 *   1. With VITE_WAITLIST_URL undefined: waitlist CTAs are <button disabled>.
 *   2. With VITE_WAITLIST_URL set: waitlist CTAs are <a href="…" target="_blank">.
 *   3. "Begin →" is always a single <a> → /dashboard?source=recorded.
 *   4. No external <a href> other than the allowed set.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// MarketingLanding is imported lazily inside each test because import.meta.env
// must be stubbed BEFORE the module loads (vitest doesn't yet support
// per-test module resets cleanly without dynamic import). We use a helper.
// NOTE: if the implementation team uses a different path, adjust here.
// The canonical path per DDD-05 §File map.
let MarketingLanding: React.ComponentType;

const WAITLIST_URL = 'https://waitlist.example';

// import.meta.env is writable in Vitest (happy-dom test env)
function setWaitlistUrl(url: string | undefined) {
  if (url === undefined) {
    delete (import.meta.env as Record<string, unknown>).VITE_WAITLIST_URL;
  } else {
    (import.meta.env as Record<string, unknown>).VITE_WAITLIST_URL = url;
  }
}

// Regex matching all waitlist CTA text variants per ADR-014
const WAITLIST_TEXT_RE = /Join (the )?waitlist|Reserve your (spot|sensor)/i;
// Regex for the demo CTA
const BEGIN_TEXT_RE = /Begin\s*→/;

async function renderLanding() {
  // Dynamic import so env stub is read fresh on each invocation
  const mod = await import('../../src/pages/MarketingLanding');
  MarketingLanding = mod.default ?? mod.MarketingLanding;
  const { container } = render(
    <MemoryRouter>
      <MarketingLanding />
    </MemoryRouter>,
  );
  return container;
}

afterEach(() => {
  cleanup();
  setWaitlistUrl(undefined);
});

describe('CTA targets — VITE_WAITLIST_URL unset (default buildathon state)', () => {
  beforeEach(() => setWaitlistUrl(undefined));

  it('every waitlist CTA is a <button> with the disabled attribute', async () => {
    const container = await renderLanding();

    // Collect all elements whose text matches the waitlist pattern
    const allEls = Array.from(container.querySelectorAll('button, a'));
    const waitlistEls = allEls.filter((el) =>
      WAITLIST_TEXT_RE.test(el.textContent ?? ''),
    );

    expect(
      waitlistEls.length,
      'Expected at least one waitlist CTA to exist',
    ).toBeGreaterThan(0);

    for (const el of waitlistEls) {
      expect(
        el.tagName.toLowerCase(),
        `Waitlist CTA "${el.textContent?.trim()}" should be a <button> when VITE_WAITLIST_URL is unset`,
      ).toBe('button');

      expect(
        (el as HTMLButtonElement).disabled,
        `Waitlist CTA "${el.textContent?.trim()}" should be disabled when VITE_WAITLIST_URL is unset`,
      ).toBe(true);
    }
  });
});

describe('CTA targets — VITE_WAITLIST_URL set', () => {
  beforeEach(() => setWaitlistUrl(WAITLIST_URL));

  it('every waitlist CTA is an <a> with correct href / target / rel', async () => {
    const container = await renderLanding();

    const allEls = Array.from(container.querySelectorAll('button, a'));
    const waitlistEls = allEls.filter((el) =>
      WAITLIST_TEXT_RE.test(el.textContent ?? ''),
    );

    expect(
      waitlistEls.length,
      'Expected at least one waitlist CTA to exist when URL is set',
    ).toBeGreaterThan(0);

    for (const el of waitlistEls) {
      const tagName = el.tagName.toLowerCase();
      expect(
        tagName,
        `Waitlist CTA "${el.textContent?.trim()}" should be an <a> when VITE_WAITLIST_URL is set`,
      ).toBe('a');

      const anchor = el as HTMLAnchorElement;
      // Use getAttribute to avoid DOM URL normalization (which appends a trailing slash to bare domains)
      expect(
        anchor.getAttribute('href'),
        `Waitlist CTA href should equal VITE_WAITLIST_URL`,
      ).toBe(WAITLIST_URL);
      expect(
        anchor.target,
        'Waitlist CTA should open in a new tab (_blank)',
      ).toBe('_blank');
      expect(
        anchor.rel,
        'Waitlist CTA rel should contain "noopener"',
      ).toContain('noopener');
    }
  });
});

describe('CTA targets — "Begin →" demo link (always present)', () => {
  beforeEach(() => setWaitlistUrl(undefined));

  it('exactly one "Begin →" element exists and is an <a> to /dashboard?source=recorded', async () => {
    const container = await renderLanding();

    const allEls = Array.from(container.querySelectorAll('button, a'));
    const beginEls = allEls.filter((el) =>
      BEGIN_TEXT_RE.test(el.textContent ?? ''),
    );

    expect(
      beginEls.length,
      'Expected exactly one "Begin →" CTA',
    ).toBe(1);

    const el = beginEls[0];
    expect(
      el.tagName.toLowerCase(),
      '"Begin →" should be an <a> element',
    ).toBe('a');

    const href = (el as HTMLAnchorElement).getAttribute('href') ?? '';
    expect(
      href.endsWith('/dashboard?source=recorded'),
      `"Begin →" href "${href}" should end with /dashboard?source=recorded`,
    ).toBe(true);
  });
});

describe('CTA targets — no unexpected external <a> hrefs', () => {
  beforeEach(() => setWaitlistUrl(WAITLIST_URL));

  it('no <a> href points to an external domain outside the allowed list', async () => {
    const container = await renderLanding();

    const allAnchors = Array.from(container.querySelectorAll('a[href]')) as HTMLAnchorElement[];

    // Allowed external patterns:
    //   - The configured waitlist URL
    //   - mailto: links
    //   - Anchors (same-page #)
    //   - Relative paths (no protocol)
    const forbidden = allAnchors.filter((a) => {
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        return false; // relative, anchor, mailto — skip
      }
      if (href === WAITLIST_URL) return false;
      // Google Fonts injected by MarketingLayout via <link> tags — NOT <a>
      // so they won't appear here. Any remaining http/https href is forbidden.
      return true;
    });

    expect(
      forbidden.map((a) => a.getAttribute('href')),
      'Found unexpected external <a href> links — only the waitlist URL is allowed',
    ).toEqual([]);
  });
});
