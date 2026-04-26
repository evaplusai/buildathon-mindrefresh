import { describe, it } from 'vitest';
// Note: src/workers/stateRules.ts is a Sprint-A stub.
// Sprint B (ADR-010) will implement the 3-state breath-trajectory classifier
// and turn these tests green via TDD.
import '../../src/workers/stateRules';

describe('stateRules (ADR-010 — 3-state breath-trajectory classifier)', () => {
  it.todo(
    'transitions regulated → activated after 60s of breath > 14 BPM rising > 1 BPM/min',
  );

  it.todo(
    'transitions activated → recovering after 30s of descent > 0.5 BPM/min',
  );

  it.todo(
    'transitions recovering → regulated after 30s within regulated band with flat trend',
  );

  it.todo('honours the 5-second minimum dwell debounce on every transition');

  it.todo(
    'rejects illegal transitions (e.g. regulated → recovering directly)',
  );
});
