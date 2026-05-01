/**
 * copy.spec.ts
 *
 * Pure unit test (ADR-014).
 *
 * Reads the design HTML via fs and imports marketingCopy, then asserts a
 * curated set of load-bearing anchor strings appear in BOTH the design HTML
 * (sanity-check on the fixture) AND in JSON.stringify(marketingCopy) (drift
 * guard).
 *
 * Approach: anchor-based rather than full verbatim extraction, which is
 * brittle to &nbsp; / whitespace differences.  Each anchor catches an
 * entire section's presence.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
// path module is no longer needed — DESIGN_HTML_PATH uses an absolute path literal.

// Read design HTML — absolute path per CLAUDE.md requirement
const DESIGN_HTML_PATH =
  '/Users/eva/Workspace/work/buildathon-mindrefresh/docs/03_designs/MindRefreshStudio v2.html';
const designHtml = fs.readFileSync(DESIGN_HTML_PATH, 'utf8');

// Import copy at module scope so import errors surface clearly
import { marketingCopy } from '../../src/data/marketing-copy';
const copyJson = JSON.stringify(marketingCopy);

// Helper — asserts string appears in both sources
function assertAnchor(anchor: string, label: string) {
  // Trim the anchor for comparison so leading/trailing whitespace in the
  // template literal below doesn't cause spurious failures
  const a = anchor.trim();

  const inHtml = designHtml.includes(a);
  expect(inHtml, `Anchor "${label}" not found in design HTML`).toBe(true);

  const inCopy = copyJson.includes(a);
  expect(
    inCopy,
    `Anchor "${label}" found in design HTML but MISSING from marketingCopy — copy has drifted`,
  ).toBe(true);
}

describe('marketing copy — anchor parity with design HTML (ADR-014)', () => {
  it('banner: "Early access is open"', () => {
    assertAnchor('Early access is open', 'banner');
  });

  it('hero h1: contains "Catch the burnout"', () => {
    assertAnchor('Catch the burnout', 'hero h1 A');
  });

  it('hero h1: contains "before" (the italic emphasis word)', () => {
    // The italic split means the literal text "before" appears in the h1
    assertAnchor('before', 'hero h1 em');
  });

  it('manifesto headline: "Learn your patterns"', () => {
    assertAnchor('Learn your patterns', 'manifesto headline');
  });

  it('hero mockup body: "Tuesday, 2:42 PM"', () => {
    assertAnchor('Tuesday, 2:42 PM', 'hero mockup body');
  });

  it('stats: first stat num "8–12"', () => {
    // em dash character in the HTML
    assertAnchor('8–12', 'stats first num');
  });

  it('problem callout: "You don\'t need another graph"', () => {
    assertAnchor("You don't need another graph", 'problem callout');
  });

  it('how-it-works step 1: "Plug in the sensor"', () => {
    assertAnchor('Plug in the sensor', 'how step 1 title');
  });

  it('live-demo card alert: "Rising activation"', () => {
    assertAnchor('Rising activation', 'live-demo card alert');
  });

  it('vs-wearables them column: "The day you" + "had"', () => {
    assertAnchor('The day you', 'vs them h3 part A');
    assertAnchor('had', 'vs them h3 part B');
  });

  it('testimonials: Maya R. quote "I didn\'t feel stressed"', () => {
    assertAnchor("I didn't feel stressed", 'testimonials Maya R. quote');
  });

  it('isnt-list: "A wearable"', () => {
    assertAnchor('A wearable', 'isnt card 1');
  });

  it('isnt-list: "A score-tracker"', () => {
    assertAnchor('A score-tracker', 'isnt card 2');
  });

  it('isnt-list: "A medical device"', () => {
    assertAnchor('A medical device', 'isnt card 3');
  });

  it('final-cta h2: "Catch the day"', () => {
    assertAnchor('Catch the day', 'final-cta h2');
  });

  it('footer copyright: "© 2026 MindRefresh"', () => {
    // © in HTML is "©" but the rendered text / copy file uses the unicode char
    // Check for either form in the HTML (it's literal © in the file)
    const copyrightInHtml =
      designHtml.includes('© 2026 MindRefresh') ||
      designHtml.includes('&copy; 2026 MindRefresh');
    expect(copyrightInHtml, 'Footer © line not found in design HTML').toBe(true);

    const copyrightInCopy =
      copyJson.includes('© 2026 MindRefresh') ||
      copyJson.includes('\\u00a9 2026 MindRefresh');
    expect(
      copyrightInCopy,
      'Footer © line not found in marketingCopy — copy has drifted',
    ).toBe(true);
  });
});
