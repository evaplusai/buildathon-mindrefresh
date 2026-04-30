-- ─────────────────────────────────────────────────────────────────────────────
-- ADR-019 — V2 waitlist email capture.
--
-- Single new table for the marketing-page email-capture modal. Anon-key
-- writes are allowed (RLS disabled), matching the V1 pattern from ADR-007.
-- The `(email, source)` unique constraint prevents the same surface from
-- creating duplicate rows on accidental double-submission.
--
-- Source of truth: docs/adr/ADR-019-waitlist-email-capture-and-login-cta.md
-- §D Persistence schema.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.waitlist_signups (
  id     uuid primary key default gen_random_uuid(),
  email  text not null,
  ts     timestamptz not null default now(),
  source text not null check (source in ('banner','nav','hero','final-cta','other')),
  unique (email, source)
);

create index if not exists waitlist_signups_ts_idx
  on public.waitlist_signups(ts desc);

-- Note: no RLS enabled in V2 (matches ADR-007 §"RLS DISABLED" pattern).
-- Magic-link auth + per-user RLS upgrade is post-buildathon (ADR-011).
