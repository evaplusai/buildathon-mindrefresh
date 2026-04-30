/**
 * Agent 1 on-device tests — ADR-016 §Test Hooks.
 *
 * 8 canonical test cases (one per PatternKey) run in Path B mode
 * (forceFallback: true) so no MCP or network is required.
 *
 * A 9th test asserts that Path A defaults to Path B when globalThis.mcp is absent.
 *
 * Privacy proof: global fetch is mocked and the test asserts that NO call
 * to anthropic.com or any non-localhost host is made.
 *
 * Ownership: client-coder (Sprint B Block 2, task DB-B2-T2).
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { runPatternScorer } from '../../src/services/reflect/agent1-pattern-scorer';
import type { PatternKey } from '../../src/types/reflection';

// ---------------------------------------------------------------------------
// Mock global fetch — assert no call to non-localhost hosts
// ---------------------------------------------------------------------------

const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => {
  const url = String(typeof _input === 'string' ? _input : (_input as URL).href ?? _input);
  if (url.includes('anthropic.com') || (url.startsWith('http') && !url.startsWith('http://localhost'))) {
    throw new Error(`Privacy violation: fetch called on non-localhost URL: ${url}`);
  }
  return Promise.resolve(new Response('{}'));
});

beforeAll(() => {
  vi.stubGlobal('fetch', fetchMock);
  // Ensure globalThis.mcp is absent so Path B is used
  vi.stubGlobal('mcp', undefined);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function topPattern(text: string): Promise<{ key: PatternKey; score: number }> {
  const output = await runPatternScorer({ text, forceFallback: true });
  expect(output.patterns.length).toBeGreaterThan(0);
  return { key: output.patterns[0].key, score: output.patterns[0].score };
}

// ---------------------------------------------------------------------------
// 8 canonical pattern tests (one per PatternKey)
// ---------------------------------------------------------------------------

describe('Agent 1 — on-device pattern scorer (Path B)', () => {
  it("'I'm so behind on everything' → top pattern is urgency", async () => {
    const { key, score } = await topPattern("I'm so behind on everything");
    expect(key).toBe('urgency' satisfies PatternKey);
    expect(score).toBeGreaterThan(0);
  });

  it("'Everything is always disaster' → top pattern is catastrophizing", async () => {
    const { key, score } = await topPattern('Everything is always disaster');
    expect(key).toBe('catastrophizing' satisfies PatternKey);
    expect(score).toBeGreaterThan(0);
  });

  it("'I keep replaying that meeting' → top pattern is rumination", async () => {
    const { key, score } = await topPattern('I keep replaying that meeting');
    expect(key).toBe('rumination' satisfies PatternKey);
    expect(score).toBeGreaterThan(0);
  });

  it("'I'm so tired and exhausted' → top pattern is exhaustion", async () => {
    const { key, score } = await topPattern("I'm so tired and exhausted");
    expect(key).toBe('exhaustion' satisfies PatternKey);
    expect(score).toBeGreaterThan(0);
  });

  it("'So much to do my head is spinning' → top pattern is overwhelm", async () => {
    const { key, score } = await topPattern('So much to do my head is spinning');
    expect(key).toBe('overwhelm' satisfies PatternKey);
    expect(score).toBeGreaterThan(0);
  });

  it("'It's fine, just nothing' → top pattern is minimization", async () => {
    const { key, score } = await topPattern("It's fine, just nothing");
    expect(key).toBe('minimization' satisfies PatternKey);
    expect(score).toBeGreaterThan(0);
  });

  it("'I should have done better' → top pattern is perfectionism", async () => {
    const { key, score } = await topPattern('I should have done better');
    expect(key).toBe('perfectionism' satisfies PatternKey);
    expect(score).toBeGreaterThan(0);
  });

  it("'Nobody, just me' → top pattern is isolation", async () => {
    const { key, score } = await topPattern('Nobody, just me');
    expect(key).toBe('isolation' satisfies PatternKey);
    expect(score).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 9: Path A defaults to Path B when globalThis.mcp is absent
  // -------------------------------------------------------------------------

  it('Path A defaults to Path B when globalThis.mcp is absent', async () => {
    // mcp is already stubbed to undefined in beforeAll.
    // Call WITHOUT forceFallback — should still return a valid result via Path B.
    const output = await runPatternScorer({
      text: "I'm so tired and exhausted",
      forceFallback: false,
    });
    expect(output.patterns.length).toBeGreaterThan(0);
    expect(output.patterns[0].key).toBe('exhaustion');
    expect(output.patterns[0].score).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Privacy proof: fetch was never called on a non-localhost host
  // -------------------------------------------------------------------------

  it('privacy proof: no fetch call to anthropic.com or non-localhost host', () => {
    const nonLocalCalls = fetchMock.mock.calls.filter(([input]) => {
      const url = String(typeof input === 'string' ? input : (input as URL).href ?? input);
      return url.includes('anthropic.com') || (url.startsWith('http') && !url.startsWith('http://localhost'));
    });
    expect(nonLocalCalls).toHaveLength(0);
  });
});
