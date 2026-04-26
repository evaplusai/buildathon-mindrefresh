import { describe, it, expect } from 'vitest';
import fixture from '../fixtures/affirmations.fixture.json';
import type { Affirmation } from '../../src/types/intervention';
import { pickAffirmation } from '../../src/services/affirmationFilter';

const corpus = fixture as Affirmation[];

/** Deterministic RNG: returns successive values from `seq`, then loops. */
function seededRandom(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i % seq.length];
    i += 1;
    return v;
  };
}

describe('affirmationFilter (Sprint C will land src/services/affirmationFilter.ts)', () => {
  it('the fixture corpus is well-formed and contains all three states', () => {
    expect(Array.isArray(corpus)).toBe(true);
    const states = new Set(corpus.map((a) => a.state));
    expect(states.has('regulated')).toBe(true);
    expect(states.has('activated')).toBe(true);
    expect(states.has('recovering')).toBe(true);
  });

  it('given state=activated returns one affirmation whose state field is activated', () => {
    const intervention = pickAffirmation({
      corpus,
      state: 'activated',
      transitionId: 't-1',
      recentIds: [],
      ts: 1_700_000_000,
      random: seededRandom([0]),
    });
    const picked = corpus.find((a) => a.id === intervention.affirmationId);
    expect(picked).toBeDefined();
    expect(picked?.state).toBe('activated');
    expect(intervention.transitionId).toBe('t-1');
    expect(intervention.ts).toBe(1_700_000_000);
  });

  it('excludes the last 5 shown affirmation ids from the candidate set', () => {
    // Activated entries in fixture: som-005..som-008. Exclude the first 3 and
    // we should get one of the remaining ids back across many seeds.
    const recentIds = ['som-005', 'som-006', 'som-007'];
    const survivorIds = new Set(['som-008']);
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const intervention = pickAffirmation({
        corpus,
        state: 'activated',
        transitionId: 't-2',
        recentIds,
        ts: 1,
        random: () => r,
      });
      expect(survivorIds.has(intervention.affirmationId)).toBe(true);
      expect(recentIds.includes(intervention.affirmationId)).toBe(false);
    }
  });

  it('with seeded Math.random returns a deterministic affirmation id across runs', () => {
    const args = {
      corpus,
      state: 'regulated' as const,
      transitionId: 't-3',
      recentIds: [],
      ts: 42,
      random: seededRandom([0.5]),
    };
    const a = pickAffirmation(args);
    const b = pickAffirmation(args);
    expect(a.affirmationId).toBe(b.affirmationId);
    // 4 regulated entries; 0.5 → index 2 → som-003.
    expect(a.affirmationId).toBe('som-003');
  });

  it('partially relaxes recency exclusion (drops oldest first) when state-filtering would empty the set', () => {
    // All 4 activated ids are in the recency window; the OLDEST is som-005.
    // After one relaxation, som-005 must be the only re-eligible candidate.
    const recentIds = ['som-005', 'som-006', 'som-007', 'som-008'];
    const intervention = pickAffirmation({
      corpus,
      state: 'activated',
      transitionId: 't-4',
      recentIds,
      ts: 1,
      random: () => 0,
    });
    expect(intervention.affirmationId).toBe('som-005');
  });

  it('breath pattern is selected by state alone (invariant 7)', () => {
    const r = pickAffirmation({
      corpus,
      state: 'regulated',
      transitionId: 't-5',
      recentIds: [],
      ts: 0,
      random: () => 0,
    });
    const a = pickAffirmation({
      corpus,
      state: 'activated',
      transitionId: 't-6',
      recentIds: [],
      ts: 0,
      random: () => 0,
    });
    const rec = pickAffirmation({
      corpus,
      state: 'recovering',
      transitionId: 't-7',
      recentIds: [],
      ts: 0,
      random: () => 0,
    });
    expect(r.breathPattern).toBe('natural');
    expect(a.breathPattern).toBe('cyclic_sigh');
    expect(rec.breathPattern).toBe('extended_exhale');
  });

  it('throws if the corpus has no entry for the requested state', () => {
    const onlyRegulated = corpus.filter((a) => a.state === 'regulated');
    expect(() =>
      pickAffirmation({
        corpus: onlyRegulated,
        state: 'activated',
        transitionId: 't-8',
        recentIds: [],
        ts: 0,
        random: () => 0,
      }),
    ).toThrow(/no affirmation for state/);
  });
});
