import { describe, it } from 'vitest';
// Sprint C will implement src/services/sessionStore.ts (Memory DDD aggregate).
// These tests encode the structural privacy invariants from
// docs/ddd/04_memory_context.md §Invariants.

describe('sessionStore — structural privacy invariants (Memory DDD)', () => {
  it.todo(
    'globalThis.fetch spy: every recorded URL origin matches *.supabase.co or mailto: (never any other origin)',
  );

  it.todo(
    'appendTransition does NOT serialize a breathBpm or hrBpm series (only single sample-at-transition values per §8 schema)',
  );

  it.todo(
    'appendWhatsAlive writes to IndexedDB and does NOT call fetch (V1: no Supabase column for user-typed text)',
  );

  it.todo(
    'every Supabase row carries user_id = "demo-user-001" per ADR-007',
  );

  it.todo(
    'recentAffirmationIds returns at most 5 ids, ordered most-recent-first',
  );
});
