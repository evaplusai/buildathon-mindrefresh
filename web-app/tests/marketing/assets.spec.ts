/**
 * assets.spec.ts
 *
 * Pure unit test (ADR-014 §Image pipeline).
 *
 * Hardcodes the 4 canonical image paths from the ADR and asserts each
 * exists in web-app/public/marketing/.  This is faster than rendering
 * the full component tree and achieves the same invariant: no broken
 * images post-deploy.
 *
 * If a fifth image is ever added, the dev adds it here — the test is the
 * single source of truth for the expected asset manifest.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PUBLIC_MARKETING = path.resolve(
  __dirname,
  '../../public/marketing',
);

// Canonical 4 PNGs from ADR-014 §Image pipeline
const EXPECTED_ASSETS = [
  'room-notices-v4.png',
  '01-late-night-clean.png',
  '02-the-shift-clean.png',
  '03-recovery-mode-clean.png',
];

describe('web-app/public/marketing/ — required PNG assets exist (ADR-014)', () => {
  it('public/marketing/ directory itself exists', () => {
    expect(
      fs.existsSync(PUBLIC_MARKETING),
      `Expected directory ${PUBLIC_MARKETING} to exist (ADR-014 §Image pipeline)`,
    ).toBe(true);
  });

  for (const filename of EXPECTED_ASSETS) {
    it(`${filename} is present on disk`, () => {
      const fullPath = path.join(PUBLIC_MARKETING, filename);
      expect(
        fs.existsSync(fullPath),
        `Missing asset: ${fullPath}\n` +
          'ADR-014 requires this PNG to be in web-app/public/marketing/. ' +
          'Run: mv docs/03_designs/images/' + filename + ' web-app/public/marketing/',
      ).toBe(true);
    });
  }
});
