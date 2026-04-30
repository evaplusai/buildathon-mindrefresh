/**
 * tokens.spec.ts
 *
 * Pure unit test — reads marketing-tokens.css from disk with Node fs and
 * asserts every CSS variable in the ADR-013 canonical token table appears
 * exactly once with the canonical hex / rgba value.
 *
 * Does NOT use Vite's `?raw` import (requires the Vite build pipeline);
 * instead reads the file with `fs.readFileSync` which works in Vitest's
 * Node environment.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TOKENS_PATH = path.resolve(
  __dirname,
  '../../src/styles/marketing-tokens.css',
);

const cssText = fs.readFileSync(TOKENS_PATH, 'utf8');

// --- Canonical hex table (ADR-013 §Color token mapping) ---
const HEX_TOKENS: [varName: string, hex: string][] = [
  ['--green-50',  '#EAF3DE'],
  ['--green-100', '#C0DD97'],
  ['--green-200', '#97C459'],
  ['--green-300', '#7FB13C'],
  ['--green-400', '#639922'],
  ['--green-600', '#3B6D11'],
  ['--green-700', '#2F5A0D'],
  ['--green-800', '#27500A'],
  ['--green-900', '#173404'],
  ['--cream',      '#FBF9F2'],
  ['--cream-2',    '#F5F1E4'],
  ['--warm-white', '#FFFEFA'],
  ['--ink',        '#1A2310'],
  ['--ink-soft',   '#3D4A2E'],
  ['--ink-muted',  '#6B7558'],
  ['--rose',       '#C97A6B'],
];

// rgba tokens — whitespace-insensitive match
const RGBA_TOKENS: [varName: string, rgbaPattern: RegExp][] = [
  ['--line',      /rgba\(\s*39\s*,\s*80\s*,\s*10\s*,\s*0\.12\s*\)/],
  ['--line-soft', /rgba\(\s*39\s*,\s*80\s*,\s*10\s*,\s*0\.06\s*\)/],
];

describe('marketing-tokens.css — ADR-013 canonical hex values', () => {
  for (const [varName, hex] of HEX_TOKENS) {
    it(`${varName} is defined exactly once with value ${hex}`, () => {
      // Match the variable declaration:  --var-name: <value>;
      const re = new RegExp(
        `${varName.replace('-', '\\-')}\\s*:\\s*(#[0-9A-Fa-f]+)`,
        'g',
      );
      const matches = [...cssText.matchAll(re)];
      expect(
        matches.length,
        `Expected exactly 1 declaration of ${varName}, found ${matches.length}`,
      ).toBe(1);

      const value = matches[0][1].toUpperCase();
      expect(
        value,
        `${varName}: expected ${hex.toUpperCase()}, got ${value}`,
      ).toBe(hex.toUpperCase());
    });
  }

  for (const [varName, rgbaPattern] of RGBA_TOKENS) {
    it(`${varName} is defined exactly once with the canonical rgba value`, () => {
      // Find lines containing the variable name
      const lineRe = new RegExp(`${varName.replace('-', '\\-')}\\s*:([^;]+);`, 'g');
      const lineMatches = [...cssText.matchAll(lineRe)];
      expect(
        lineMatches.length,
        `Expected exactly 1 declaration of ${varName}, found ${lineMatches.length}`,
      ).toBe(1);

      const rawValue = lineMatches[0][1].trim();
      expect(
        rgbaPattern.test(rawValue),
        `${varName}: "${rawValue}" does not match expected rgba pattern ${rgbaPattern}`,
      ).toBe(true);
    });
  }
});
