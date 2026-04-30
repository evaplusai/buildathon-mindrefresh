/**
 * isolation.spec.ts
 *
 * Pure unit test — static import-boundary check (DDD-05 §Anti-corruption,
 * ADR-013 §Isolation rules).
 *
 * Direction A: no file inside the marketing context imports from the
 * four product DDDs or their service/worker/type modules.
 *
 * Direction B: no file inside the dashboard context imports from
 * marketing tokens, marketing components, or marketing copy.
 *
 * Implementation uses fs + regex; no AST parser needed.  If a file matches
 * a forbidden pattern, the test names it explicitly so the developer knows
 * exactly which import to remove.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../src');

// --- helpers ---

function readFilesRecursive(dir: string, exts = ['.ts', '.tsx']): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readFilesRecursive(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

function findForbiddenImports(files: string[], patterns: RegExp[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        violations.push(`${file}: matches forbidden pattern ${pattern}`);
      }
    }
  }
  return violations;
}

// --- Direction A: marketing tree must not import product DDD internals ---

const MARKETING_FILES = [
  // All .ts/.tsx under components/marketing/
  ...readFilesRecursive(path.join(ROOT, 'components/marketing')),
  // The marketing page
  path.join(ROOT, 'pages/MarketingLanding.tsx'),
  // The marketing root wrapper
  path.join(ROOT, 'pages/MarketingRoot.tsx'),
  // The copy data file
  path.join(ROOT, 'data/marketing-copy.ts'),
].filter(fs.existsSync); // tolerate files not yet created (pre-implementation)

const FORBIDDEN_FROM_MARKETING: RegExp[] = [
  /from\s+['"][^'"]*services\/wsClient/,
  /from\s+['"][^'"]*services\/sessionStore/,
  /from\s+['"][^'"]*services\/cloudSync/,
  /from\s+['"][^'"]*workers\//,
  /from\s+['"][^'"]*types\/vitals/,
  /from\s+['"][^'"]*types\/state/,
  /from\s+['"][^'"]*types\/intervention/,
  /from\s+['"][^'"]*components\/dashboard\//,
];

// --- Direction B: dashboard tree must not import marketing code/tokens ---

const DASHBOARD_FILES = [
  path.join(ROOT, 'pages/Dashboard.tsx'),
  ...readFilesRecursive(path.join(ROOT, 'components/dashboard')),
].filter(fs.existsSync);

const FORBIDDEN_FROM_DASHBOARD: RegExp[] = [
  /from\s+['"][^'"]*styles\/marketing-tokens/,
  /from\s+['"][^'"]*components\/marketing\//,
  /from\s+['"][^'"]*data\/marketing-copy/,
];

// --- Tests ---

describe('Isolation — Direction A: marketing context imports no product DDD code', () => {
  it('no marketing file imports wsClient, sessionStore, cloudSync, workers, vitals/state/intervention types, or dashboard components', () => {
    if (MARKETING_FILES.length === 0) {
      // Implementation not yet created — skip gracefully (pre-implementation stub)
      console.warn('No marketing files found; isolation check skipped (implementation pending).');
      return;
    }

    const violations = findForbiddenImports(MARKETING_FILES, FORBIDDEN_FROM_MARKETING);

    expect(
      violations,
      violations.length > 0
        ? `Marketing context boundary violation(s):\n${violations.join('\n')}\n\nRemove these imports to satisfy DDD-05 §Anti-corruption layer.`
        : '',
    ).toEqual([]);
  });
});

describe('Isolation — Direction B: dashboard context imports no marketing code', () => {
  it('no dashboard file imports marketing-tokens.css, marketing components, or marketing-copy', () => {
    if (DASHBOARD_FILES.length === 0) {
      console.warn('No dashboard files found; isolation check skipped.');
      return;
    }

    const violations = findForbiddenImports(DASHBOARD_FILES, FORBIDDEN_FROM_DASHBOARD);

    expect(
      violations,
      violations.length > 0
        ? `Dashboard context boundary violation(s):\n${violations.join('\n')}\n\nRemove these imports to satisfy ADR-013 §Isolation rules.`
        : '',
    ).toEqual([]);
  });
});
