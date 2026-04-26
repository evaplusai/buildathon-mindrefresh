-- ─────────────────────────────────────────────────────────────────────────────
-- MindRefreshStudio — V1 Supabase migration (2 tables, anon writes, no auth).
--
-- V1 simplified per ADR-007. Magic-link auth + RLS upgrade is post-buildathon
-- (ADR-011 deferred). All rows are written under the hardcoded
-- `user_id = 'demo-user-001'`. RLS is intentionally DISABLED in V1 so the
-- supabase-js anon client (the only auth surface in V1) can read+write.
--
-- Source of truth: docs/02_research/05_canonical_build_plan.md §8.
-- See also: docs/ddd/04_memory_context.md (Memory bounded context invariants).
--
-- DO NOT add tables for raw_vitals, whats_alive, or wellness_vector_samples
-- without a new ADR explicitly reversing this. Memory DDD invariants 1 + 2
-- guard the privacy promise; the schema below is the structural mirror.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. state_transitions
create table if not exists public.state_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user-001',
  ts timestamptz not null default now(),
  from_state text not null check (from_state in ('regulated','activated','recovering')),
  to_state text not null check (to_state in ('regulated','activated','recovering')),
  trigger_reason text,                  -- 'acute_spike' | 'slow_drift' | 'recovery' | 'manual' | 'morning_check'
  breath_bpm numeric,                   -- breath rate AT transition (1 sample, not series)
  hr_bpm numeric                        -- hr_bpm: V2 migration field; V1 stores one display sample only; see ADR-006
);
create index if not exists state_transitions_user_id_ts_idx
  on public.state_transitions(user_id, ts desc);

-- 2. interventions
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user-001',
  transition_id uuid references public.state_transitions(id) on delete cascade,
  affirmation_id text not null,         -- e.g. 'som-006'
  breath_pattern text not null,         -- 'natural' | 'cyclic_sigh' | 'extended_exhale'
  user_feedback text check (user_feedback in ('helped','neutral','unhelpful')),
  ts timestamptz not null default now()
);
create index if not exists interventions_user_id_idx
  on public.interventions(user_id);

-- V1 keeps RLS DISABLED on both tables; the anon role has read+write via
-- the supabase-js anon key. ADR-011 (Deferred): enable RLS, switch to
-- authenticated role, magic-link auth UI.
alter table public.state_transitions disable row level security;
alter table public.interventions disable row level security;
