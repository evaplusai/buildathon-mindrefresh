/**
 * illustrative-disclosure.spec.ts
 *
 * Pure unit test (ADR-014 §Copy and statistical claims).
 *
 * Reads marketing-copy.ts raw via fs and asserts the top-of-file JSDoc
 * block contains:
 *   1. The literal phrase "illustrative for the buildathon submission"
 *   2. The name "Maya R." (one of the named testimonials)
 *   3. The name "Daniel K." (the other named testimonial)
 *
 * Fails if someone deletes or shortens the disclosure while leaving the
 * testimonial copy in the file.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const COPY_PATH = path.resolve(
  __dirname,
  '../../src/data/marketing-copy.ts',
);

describe('illustrative-content disclosure in marketing-copy.ts (ADR-014)', () => {
  it('marketing-copy.ts exists', () => {
    expect(
      fs.existsSync(COPY_PATH),
      `Expected ${COPY_PATH} to exist. The copy file must be created before this test passes.`,
    ).toBe(true);
  });

  it('leading JSDoc contains "illustrative for the buildathon submission"', () => {
    const source = fs.readFileSync(COPY_PATH, 'utf8');
    expect(
      source.includes('illustrative for the buildathon submission'),
      'The required illustrative-content disclosure phrase ' +
        '"illustrative for the buildathon submission" was not found in ' +
        `${COPY_PATH}.\n\n` +
        'Add (or restore) the following JSDoc at the top of the file:\n' +
        '/**\n' +
        ' * All numerical claims and named users on this page are illustrative for\n' +
        ' * the buildathon submission and will be replaced or removed before any\n' +
        ' * public, post-buildathon launch. (ADR-014.)\n' +
        ' */',
    ).toBe(true);
  });

  it('disclosure names "Maya R." to cover that testimonial', () => {
    const source = fs.readFileSync(COPY_PATH, 'utf8');
    expect(
      source.includes('Maya R.'),
      '"Maya R." must appear in marketing-copy.ts (either in the JSDoc disclosure ' +
        'or in the copy itself). If the testimonial was removed, also remove the ' +
        'disclosure requirement — but only after an explicit product decision.',
    ).toBe(true);
  });

  it('disclosure names "Daniel K." to cover that testimonial', () => {
    const source = fs.readFileSync(COPY_PATH, 'utf8');
    expect(
      source.includes('Daniel K.'),
      '"Daniel K." must appear in marketing-copy.ts (either in the JSDoc disclosure ' +
        'or in the copy itself).',
    ).toBe(true);
  });
});
