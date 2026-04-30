/**
 * cta-targets.spec.tsx
 *
 * Vitest + React Testing Library.
 * Renders <MarketingLanding /> inside a MemoryRouter and asserts CTA
 * wiring rules from ADR-012 + ADR-019 (+ ADR-014 partial supersession).
 *
 * V2 wiring per ADR-019:
 *   - Top-right nav CTA is now "Login" → <a href="/dashboard">.
 *   - 3 waitlist CTAs (banner / hero / final-cta) are <button> elements
 *     that open the WaitlistModal on click (no longer external anchors,
 *     no longer disabled).
 *   - "Begin →" stays an <a> → /dashboard?source=recorded.
 *   - Logo is a <Link to="/"> with aria-label "MindRefresh — home".
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

let MarketingLanding: React.ComponentType;

// Regex matching all body waitlist CTA text variants per ADR-019 §C.
const WAITLIST_TEXT_RE = /Join (the )?waitlist|Reserve your (spot|sensor)/i;
const LOGIN_TEXT_RE = /^Login$/;
const BEGIN_TEXT_RE = /Begin\s*→/;

async function renderLanding() {
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
});

describe('CTA targets — Login (top-right nav CTA, ADR-019 §B)', () => {
  it('exactly one "Login" anchor exists with href="/dashboard"', async () => {
    const container = await renderLanding();
    const anchors = Array.from(container.querySelectorAll('a'));
    const loginAnchors = anchors.filter((a) =>
      LOGIN_TEXT_RE.test((a.textContent ?? '').trim()),
    );
    expect(loginAnchors.length, 'exactly one <a>Login</a>').toBe(1);
    expect(loginAnchors[0].getAttribute('href')).toBe('/dashboard');
  });
});

describe('CTA targets — Logo link (ADR-019 §A)', () => {
  it('the brand logo + text resolve to <a href="/"> with aria-label', async () => {
    const container = await renderLanding();
    const logoLink = container.querySelector(
      'a[aria-label*="home" i]',
    ) as HTMLAnchorElement | null;
    expect(logoLink, 'logo link should exist with aria-label "...home"').not.toBeNull();
    expect(logoLink?.getAttribute('href')).toBe('/');
    expect(logoLink?.textContent ?? '').toMatch(/MindRefresh/);
  });
});

describe('CTA targets — body waitlist CTAs (ADR-019 §C)', () => {
  it('every waitlist CTA is an enabled <button> (not <a>, not disabled)', async () => {
    const container = await renderLanding();
    const allEls = Array.from(container.querySelectorAll('button, a'));
    const waitlistEls = allEls.filter((el) =>
      WAITLIST_TEXT_RE.test(el.textContent ?? ''),
    );

    expect(
      waitlistEls.length,
      'expected at least 3 body waitlist CTAs (banner / hero / final-cta)',
    ).toBeGreaterThanOrEqual(3);

    for (const el of waitlistEls) {
      expect(
        el.tagName.toLowerCase(),
        `waitlist CTA "${el.textContent?.trim()}" should be a <button>`,
      ).toBe('button');

      expect(
        (el as HTMLButtonElement).disabled,
        `waitlist CTA "${el.textContent?.trim()}" should NOT be disabled (V2 ships email capture per ADR-019)`,
      ).toBe(false);
    }
  });
});

describe('CTA targets — "Begin →" demo link (always present)', () => {
  it('exactly one "Begin →" element exists and is an <a> to /dashboard?source=recorded', async () => {
    const container = await renderLanding();
    const allEls = Array.from(container.querySelectorAll('button, a'));
    const beginEls = allEls.filter((el) => BEGIN_TEXT_RE.test(el.textContent ?? ''));

    expect(beginEls.length).toBe(1);
    const el = beginEls[0];
    expect(el.tagName.toLowerCase()).toBe('a');
    const href = (el as HTMLAnchorElement).getAttribute('href') ?? '';
    expect(href.endsWith('/dashboard?source=recorded')).toBe(true);
  });
});

describe('CTA targets — no unexpected external <a> hrefs', () => {
  it('no <a> href points to an external HTTP/HTTPS domain', async () => {
    const container = await renderLanding();
    const allAnchors = Array.from(
      container.querySelectorAll('a[href]'),
    ) as HTMLAnchorElement[];

    const forbidden = allAnchors.filter((a) => {
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        return false;
      }
      // Google Fonts <link> tags are <link>, not <a>, so they don't surface here.
      return true;
    });

    expect(
      forbidden.map((a) => a.getAttribute('href')),
      'no external HTTP(S) links allowed in V2 (ADR-019 deprecates VITE_WAITLIST_URL)',
    ).toEqual([]);
  });
});
