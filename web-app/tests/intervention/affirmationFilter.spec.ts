import { describe, it, expect } from 'vitest';
import fixture from '../fixtures/affirmations.fixture.json';
import type { Affirmation } from '../../src/types/intervention';

describe('affirmationFilter (Sprint C will land src/services/affirmationFilter.ts)', () => {
  it('the fixture corpus is well-formed and contains all three states', () => {
    const corpus = fixture as Affirmation[];
    expect(Array.isArray(corpus)).toBe(true);
    const states = new Set(corpus.map((a) => a.state));
    expect(states.has('regulated')).toBe(true);
    expect(states.has('activated')).toBe(true);
    expect(states.has('recovering')).toBe(true);
  });

  it.todo(
    'given state=activated returns one affirmation whose state field is activated',
  );

  it.todo('excludes the last 5 shown affirmation ids from the candidate set');

  it.todo(
    'with seeded Math.random returns a deterministic affirmation id across runs',
  );

  it.todo(
    'partially relaxes recency exclusion (drops oldest first) when state-filtering would empty the set',
  );
});
