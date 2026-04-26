import { describe, it } from 'vitest';
// Sprint B (S4-B3-T5) will implement the morningCheck detector in
// src/workers/triggerDetectors.ts and turn these tests green.
// The IndexedDB seeding scaffolding stays here so Sprint B can drop in assertions.
import '../../src/workers/triggerDetectors';

describe('morningCheck trigger', () => {
  it.todo(
    'fires when the previous presence event is older than 6 hours and a new presence is detected',
  );

  it.todo(
    'attaches a MorningCheckPayload with yesterdayCount, lastEventTs, todayBaseline, regulatedBaseline',
  );

  it.todo(
    'does not fire when the gap since the last presence event is less than 6 hours',
  );

  it.todo(
    'computes yesterdayCount from IndexedDB-seeded state_transitions in the last 24 hours',
  );
});
