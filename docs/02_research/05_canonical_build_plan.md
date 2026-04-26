# MindRefreshStudio — Canonical Build Plan (v3, simplified for V1 ship)

# 1. Status & Header

**Status:** Source of truth. Supersedes `docs/02_research/03_research_plan.md`. Absorbs the valid technical fixes from `docs/02_research/04_plan_review.md` (port 8765, no Node middleman, HRV out of V1) but **reverses doc 04's "drop Supabase" recommendation** — Supabase stays (see §3, §8).

**v3 amendment (2026-04-26).** Scope reduced for ship-ability inside the 4 working days remaining. **Cut from V1:** 8-dim wellness vector, HNSW retrieval (`@ruvector/core`), WebGPU LLM rephrasing (`@ruvector/ruvllm`), SONA personalisation (`@ruvector/sona`), 4-state polyvagal classifier (the `shutdown` state), magic-link auth + RLS. **Restored:** the `morning_check` trigger and Morning Comparison Card — the single strongest demo moment. **Replaced:** the 4-state classifier with a 3-state breath-trajectory model (regulated / activated / recovering). **Simplified:** Supabase from 6 tables + auth + RLS to 2 tables + anon writes + hardcoded `user_id = 'demo-user-001'` for V1 (auth + RLS gated to Day 6 slack as ADR-011 stretch). **Asset:** affirmation corpus content provided by user.

**Today:** Sun Apr 26 — Build Day 3 of 8. Submission Fri May 1 @ 3 PM ET. Day 7 (Thu Apr 30) locked for demo + write-up; Day 8 morning is buffer + submit. **Working build days remaining: 4 (Days 3–6).**

**Product:** MindRefreshStudio is a contactless, state-matched somatic-regulation companion — a single-page React web app that reads breath rate from a $9 ESP32-S3 WiFi-CSI sensor, classifies the user's nervous-system state along a 3-state breath-trajectory model (regulated / activated / recovering), and meets each transition with a state-matched somatic affirmation. **The morning check** compares today's first-presence baseline to yesterday's state events and surfaces "what last night did to today" — the strongest demo moment.

---

# 2. Architecture (final, contradiction-free, post-cuts)

```
+---------------------------------------------------------------------------+
| LAYER 1 - SENSOR (one room)                                               |
|  Heltec V3 ESP32-S3 + RuView esp32-csi-node firmware                      |
|  Streams ADR-018 binary CSI frames over UDP                               |
|         |                                                                 |
|         | UDP datagrams, port 5005, ~20 Hz                                |
|         v                                                                 |
+---------------------------------------------------------------------------+
| LAYER 2 - LOCAL DAEMON (user's machine, 127.0.0.1)                        |
|  upstream/RuView/v2/crates/wifi-densepose-sensing-server                  |
|  Pure-Rust FFT vital-sign extraction:                                     |
|    breathing_rate_bpm  (0.1-0.5 Hz band, 6-30 BPM)                        |
|    heart_rate_bpm      (0.67-2.0 Hz band, 40-120 BPM)                     |
|    presence            (motion gate)                                      |
|    motion_band_power   (whole-body translation proxy)                     |
|  Bound to 127.0.0.1 by default (verified upstream/.../cli.rs L31).        |
|         |                                                                 |
|         | WebSocket JSON, ws://localhost:8765/ws/sensing  (1 Hz update)   |
|         v                                                                 |
+---------------------------------------------------------------------------+
| LAYER 3 - REACT SPA (browser, served by Vercel)                           |
|  WebSocket client (main thread)                                           |
|         |                                                                 |
|         | postMessage VitalsFrame                                         |
|         v                                                                 |
|  Web Worker: triggerWorker.ts                                             |
|    - Ring buffers (60 s breath / HR for display / motion)                 |
|    - 3-state breath-trajectory classifier (debounced 5 s)                 |
|    - Trigger detectors:                                                   |
|        acute_spike    (breath rises >4 BPM in 30 s)                       |
|        slow_drift     (breath trends up >1 BPM/min for 10 min)            |
|        recovery       (breath descends after activated)                   |
|        manual         (user taps "I need a moment")                       |
|        morning_check  (first presence after >6 h gap; query yesterday)   |
|         |                                                                 |
|         | postMessage {state-transition, trigger-event}                  |
|         v                                                                 |
|  Main thread:                                                             |
|    - Affirmation lookup: filter user-supplied JSON by state, random pick  |
|    - UI: BreathGuide, AffirmationCard, StateBadge, BreathTrace,           |
|          MorningCheckCard, TrustedWitness                                 |
|    - IndexedDB session store                                              |
|    - Supabase client (anon, hardcoded user_id = 'demo-user-001')          |
|         |                                                                 |
|         | HTTPS row writes (anon key)                                     |
|         v                                                                 |
+---------------------------------------------------------------------------+
| LAYER 4 - SUPABASE (managed cloud)                                        |
|  V1: 2 tables (state_transitions, interventions)                          |
|       anon-write, hardcoded user_id; no auth, no RLS                      |
|  V2 (Day 6 stretch / post-buildathon): magic-link auth + RLS              |
+---------------------------------------------------------------------------+
```

**V1 explicit non-goals (cut by user directive 2026-04-26):**
- 8-dim wellness vector (post-buildathon)
- HNSW retrieval over affirmations (post-buildathon)
- WebGPU LLM rephrasing (post-buildathon)
- SONA per-user MicroLoRA personalisation (post-buildathon)
- 4-state polyvagal classifier (`shutdown` cut; replaced by 3-state breath trajectory)
- Magic-link auth + RLS (Day 6 stretch only)

**V1 explicit includes:**
- Restored `morning_check` trigger + MorningCheckCard
- 3-state breath-trajectory classifier
- Simple state-filtered random affirmation pick
- 2-table Supabase schema with anon writes
- Recorded-CSI fixture path (`?source=recorded`) as demo fallback

---

# 3. Data Classification

The hackathon brief lists Supabase as a recommended Quick Link tool. Privacy preserved by **what we send**, not by avoiding the cloud.

**Promise:** "Raw biometric signals never leave your device. Only state events sync, to enable the morning check across devices."

| Data category | Source | Where it lives | Sent to Supabase? |
|---|---|---|---|
| Raw CSI frames (UDP) | ESP32 | sensing-server RAM only; bound to 127.0.0.1 | **Never** |
| Per-second vitals (`breathing_rate_bpm`, `heart_rate_bpm`, `presence`, `motion_band_power`) | sensing-server WS | Browser ring buffer | **Never** |
| State classification (`regulated / activated / recovering`) | Web Worker | IndexedDB | Default ON |
| State transition events (ts, from, to, trigger_reason, breath_bpm-at-transition) | Web Worker | IndexedDB + Supabase | Default ON |
| Affirmation shown (id reference, not text) | Local corpus | Supabase | Default ON |
| User feedback (helped / neutral / unhelpful) | UI tap | Supabase | Default ON |

**No raw_vitals table, no whats_alive table, no embedding tables in V1.** The morning check reads yesterday's `state_transitions` rows by `user_id = 'demo-user-001'`.

**user_id story for V1.** All writes use a constant `user_id = 'demo-user-001'`. This is a deliberate buildathon shortcut: no auth UI, no magic-link callback, no RLS configuration. Demo judges all read the same fictional user's history — which is exactly what the morning_check demo needs to show non-trivial pattern. ADR-007 documents this as a known V1 limitation; ADR-011 (Day 6 stretch) upgrades to magic-link auth + RLS if slack permits.

**Threat model.** A judge opening DevTools Network during the demo sees: (a) WebSocket to `localhost:8765` carrying post-FFT vitals only — never raw CSI; (b) HTTPS POSTs to `*.supabase.co` carrying state labels and affirmation ids only — never raw vitals, never user-typed text in V1.

---

# 4. State Classifier — 3-State Breath Trajectory (V1)

Replaces the 4-state polyvagal classifier from earlier drafts. The `shutdown` state is cut for V1 (low-confidence detection from breath alone). The 3 V1 states are:

| State | Breath rate | Trend over 60 s | Notes |
|---|---|---|---|
| **regulated** | 8–14 BPM | flat or descending | Calm baseline. Reinforcing affirmation. |
| **activated** | > 14 BPM AND rising | rising > 1 BPM/min | Sympathetic activation. Cyclic-sigh territory. |
| **recovering** | descending from `activated` | descending > 0.5 BPM/min | Post-activation return. Witness affirmation. |

**Transitions:**
- `regulated → activated` when sustained 60 s above thresholds
- `activated → recovering` when 30 s of descent at > 0.5 BPM/min
- `recovering → regulated` when 30 s within regulated range and trend flat
- `recovering → activated` direct re-entry allowed if descent reverses
- 5 s debounce on every transition

**Cold-start values** in `src/data/stateRules.json`. SONA personalisation cut from V1; thresholds remain literal until manual override (post-buildathon ADR will reintroduce per-user baseline calibration).

**Why 3 states, not 4.** The 4-state polyvagal map (regulated/rising/activated/shutdown) is the gold-standard somatic frame and remains the post-buildathon roadmap. For V1, with breath rate as the only reliable single input, three states are honest and demo-able. `shutdown` requires motion + dwell tie-breakers we are not implementing in V1; trying to claim `shutdown` detection without them would be intellectual dishonesty and would lose Functionality + Problem Clarity points more than it gains in Tech Complexity.

Citations: respiratory-cardiac coupling and stress trajectory ([Porges 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC3108032/); [WESAD, Schmidt et al. 2018](https://dl.acm.org/doi/10.1145/3242969.3242985)); cyclic sighing ([Yilmaz Balban et al. 2023](https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf)).

**Roadmap — HRV thresholds (NOT V1).** The stress example (`upstream/RuView/examples/stress/hrv_stress_monitor.py`) ships well-validated HRV bands (SDNN < 30 = HIGH STRESS, etc.) but reads HR from a 60-GHz mmWave radar with RR-interval output. Our sensing-server emits a smoothed `heart_rate_bpm`, not RR intervals — SDNN over a 1 Hz HR series is mathematically meaningless. Documented as Day-1-after-launch addition when 60-GHz radar is paired. ADR-006 codifies this.

---

# 5. Triggers — Five Detectors (including restored morning_check)

Five trigger detectors live in `src/workers/triggerDetectors.ts`. Each is a pure function over the ring buffer (or, for `morning_check`, IndexedDB + yesterday's Supabase rows).

| Trigger | Logic | Surfaces what to user |
|---|---|---|
| `acute_spike` | breath rises > 4 BPM in 30 s | Cyclic-sigh affirmation immediately |
| `slow_drift` | breath trends up > 1 BPM/min for 10 min | "Something is climbing — name it" affirmation |
| `recovery` | breath descends > 0.5 BPM/min for 30 s after `activated` | Witness affirmation for the return |
| `manual` | user taps "I need a moment" | State-matched affirmation regardless of vitals |
| **`morning_check`** | first presence-true event after a > 6 h gap | Morning Comparison Card |

**Morning Comparison Card** is the strongest single demo moment. Logic:

1. Worker watches the ring buffer; if last presence event was > 6 h ago AND a new presence is detected, fire `morning_check`.
2. Main thread queries IndexedDB and (default-on) Supabase for `state_transitions` rows in the last 24 h.
3. Render `MorningCheckCard` with three panels:
   - **Yesterday:** "you went into `activated` 4 times yesterday — last one at 11:38 PM"
   - **This morning:** "your breath is at 16 BPM (your regulated baseline is 12)"
   - **One affirmation** matched to the comparison
4. Single CTA button: "I'd like to talk about it" — opens a free-form text box. **Text not synced in V1**; lives only in IndexedDB. ADR-007 documents this.

The story this card tries to convey: **last night's choices have a body-cost the next morning, and the sensor just showed it to you, no judgement.** This is the differentiator vs. Apple Watch (after-the-fact score) and Calm (generic intervention).

---

# 6. Web Worker Architecture (replaces the Node middleman)

Doc 04 was correct: a separate Node "Trigger server" is a redundant middleman. Replaced with a Web Worker in the same browser the SPA already runs in.

**File:** `src/workers/triggerWorker.ts`. **Companion files:** `src/workers/stateRules.ts`, `src/workers/triggerDetectors.ts`.

**Why Web Worker, not Node:**
- Lower latency (no TCP localhost round-trip; postMessage ≤ 1 ms).
- One fewer process to keep alive on demo day.
- Same privacy boundary (worker is same-origin).
- IndexedDB reachable from the worker via `self.indexedDB`; `morning_check` queries without crossing back to main thread.
- A judge clicks the URL and it works — no "is your background daemon running" failure mode.

**postMessage contract:**

```ts
// Main → Worker
type Inbound =
  | { kind: 'vitals'; ts: number; breathBpm?: number; hrBpm?: number;
      presence: boolean; motionBandPower: number; source: 'live' | 'recorded' }
  | { kind: 'feedback'; transitionId: string; signal: 'helped' | 'neutral' | 'unhelpful' }
  | { kind: 'reset' };

// Worker → Main
type Outbound =
  | { kind: 'state_transition'; id: string; ts: number;
      from: State; to: State; reason: string; breathBpm: number; hrBpm?: number }
  | { kind: 'trigger'; type: 'acute_spike' | 'slow_drift' | 'recovery'
                          | 'manual' | 'morning_check';
      transitionId: string; severity: number;
      morningPayload?: { yesterdayCount: number; lastEventTs: number;
                         todayBaseline: number; regulatedBaseline: number } }
  | { kind: 'baseline_update'; field: 'breath' | 'hr'; value: number };
```

The worker owns the ring buffers, the 3-state rules, the 5 trigger detectors, and the per-user breath baseline (rolling EWMA over 7 days from IndexedDB). Affirmation lookup stays on the main thread — V1 has no HNSW or WebGPU dependencies, so a worker-side affirmation engine is unnecessary complexity.

---

# 7. Affirmation Pipeline (simplified)

**Asset:** user provides `src/data/affirmations.json` for the demo. Schema:

```json
[
  { "id": "som-001", "state": "activated",  "text": "...", "modality": "breath" },
  { "id": "som-002", "state": "recovering", "text": "...", "modality": "witness" },
  { "id": "som-003", "state": "regulated",  "text": "...", "modality": "anchor" }
]
```

**Retrieval (main thread):**
1. Worker emits `state_transition` or `trigger` event → main thread.
2. Filter `affirmations.json` by `state`.
3. Exclude any affirmation shown in the last 5 events (recency diversification).
4. Random pick from remainder.
5. Render via `AffirmationCard` (ported from `upstream/mind-refresh-05/src/components/result/AffirmationCard.tsx`; drop scripture/reference fields, keep the opacity/translate-y/scale animation).

**No HNSW, no embedding model, no WebGPU rephrasing, no `@ruvector/*` dependencies in V1.** Bundle stays small; demo path is deterministic. Post-buildathon ADR will reintroduce semantic retrieval over user-typed sentences.

The state-matched **breath pattern** for the BreathGuide animation (`src/data/breathPatterns.json`):

| State | Pattern | Source |
|---|---|---|
| regulated | natural follow (paces to user's actual breath) | Dana 2018 |
| activated | cyclic sigh (2× short inhale, long exhale) | [Yilmaz Balban et al. 2023](https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf) |
| recovering | extended exhale (4 in / 6 out) | Porges 2011 |

---

# 8. Supabase Schema (V1: 2 tables, no auth, hardcoded user_id)

**V1 simplification.** The 6-table schema with magic-link auth and RLS is post-buildathon scope. V1 ships 2 tables, anon writes, hardcoded `user_id = 'demo-user-001'`. If Day 6 has slack after feature freeze, upgrade to auth + RLS (ADR-011 stretch).

```sql
-- 1. state_transitions
create table public.state_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user-001',
  ts timestamptz not null default now(),
  from_state text not null check (from_state in ('regulated','activated','recovering')),
  to_state text not null check (to_state in ('regulated','activated','recovering')),
  trigger_reason text,                  -- 'acute_spike' | 'slow_drift' | 'recovery' | 'manual' | 'morning_check'
  breath_bpm numeric,                   -- breath rate AT transition (1 sample, not series)
  hr_bpm numeric                        -- HR at transition (1 sample)
);
create index state_transitions_user_id_ts_idx on public.state_transitions(user_id, ts desc);

-- 2. interventions
create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'demo-user-001',
  transition_id uuid references public.state_transitions(id) on delete cascade,
  affirmation_id text not null,         -- e.g. 'som-006'
  breath_pattern text not null,         -- 'natural' | 'cyclic_sigh' | 'extended_exhale'
  user_feedback text check (user_feedback in ('helped','neutral','unhelpful')),
  ts timestamptz not null default now()
);
create index interventions_user_id_idx on public.interventions(user_id);

-- V1 keeps RLS DISABLED; anon role has read+write via the supabase-js anon key.
-- ADR-011 (Day 6 stretch): enable RLS, switch to authenticated role, magic-link auth UI.
```

**V1 client setup:**
```ts
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
const USER_ID = 'demo-user-001';
// All inserts: { user_id: USER_ID, ... }
```

**No raw_vitals table, no whats_alive table, no wellness_vector_samples table in V1.** Adding any of these requires a new ADR.

**Morning check query:**
```ts
const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const { data } = await supabase
  .from('state_transitions')
  .select('*')
  .eq('user_id', USER_ID)
  .gte('ts', since)
  .order('ts', { ascending: false });
```

---

# 9. Reuse Map — V1 (post-cuts)

| Component | Source | Time | Owner |
|---|---|---|---|
| ESP32 firmware | Vendored: `upstream/RuView/firmware/esp32-csi-node` (flash via esptool) | 0.5 day | Solo |
| Sensing server | Vendored: `cargo run -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2`; release binary on Day 6 | 0.5 day build, 0.5 day calibrate | Solo |
| React SPA shell | Ruv house style: Vite + React 18 + TS + Tailwind + shadcn/ui | 0.5 day scaffold | Solo |
| AffirmationCard, ActionButtons, ResultScreen | Ported from `upstream/mind-refresh-05/src/components/result/` (drop scripture/reference fields) | 0.5 day | Solo |
| 3-state classifier rules | Greenfield (Levine/Dana/Porges literature; breath rate only) | 0.25 day | Solo |
| Web Worker (3-state classifier + 5 trigger detectors incl. `morning_check`) | Greenfield TS | 0.5 day | Solo |
| WebSocket client + ring buffer | Greenfield TS | 0.5 day | Solo |
| Supabase 2-table migration + anon client | Greenfield SQL + supabase-js | 0.25 day | Solo |
| BreathGuide animation | Greenfield Tailwind keyframes paced by live breath_bpm | 0.5 day | Solo |
| MorningCheckCard | Greenfield (queries IndexedDB + Supabase) | 0.5 day | Solo |
| Trusted Witness button | Greenfield (`mailto:` with pre-canned message) | 0.25 day | Solo |
| Recorded-CSI fallback | Greenfield (capture WS feed to JSONL; replay through same contract) | 0.25 day | Solo |
| Demo video + write-up + README | Greenfield Day 7 | 1 day | Solo |
| Affirmation corpus | **Provided by user** | 0 day (asset) | User |

**Cut from V1 (deferred post-buildathon):**
- `@ruvector/core` HNSW retrieval
- `@ruvector/ruvllm` WebGPU rephrasing
- `@ruvector/sona` MicroLoRA personalisation
- 8-dim wellness vector (the `happiness-vector` adaptation)
- 4-state polyvagal classifier (the `shutdown` state)
- WhatsAliveInput + embedding pipeline
- Magic-link auth + RLS (Day 6 stretch only)
- PatternMirror sparkline (replaced by MorningCheckCard for the demo's pattern story)

---

# 10. 4-Day Execution Plan (Days 3–6, post-cuts)

Each item ends with a rubric tag.

### Day 3 — Sun Apr 26 (today, in-progress)

1. Apply this v3 simplification; banner doc 03 superseded; write ADR-005 (architecture), ADR-006 (HRV out), ADR-007 (Supabase 2-table no-auth + hardcoded user_id), ADR-008 (port lock). **(Problem Clarity.)**
2. Verify `cargo build -p wifi-densepose-sensing-server --no-default-features` from `upstream/RuView/v2`. If pass, lock; if fail, write ADR-009 and pivot to recorded-fixture-only path. **(Functionality risk gate.)**
3. Scaffold `web-app/` with Vite + React 18 + TS + Tailwind + shadcn; deploy hello-world to Vercel. **(Functionality.)**
4. Stand up `wsClient.ts` + `triggerWorker.ts` skeleton; verify roundtrip on a mock socket. Write the 5 mock-first contract tests (§13). **(Functionality, Tech Complexity.)**

### Day 4 — Mon Apr 27

1. Provision Heltec V3 against home WiFi; flash RuView firmware via Docker (`espressif/idf:v5.2`); confirm UDP frames on port 5005, then breath/HR appearing in the WS feed. **(Functionality.)**
2. Implement 3-state breath-trajectory classifier; wire to UI as a `StateBadge`. **(Functionality.)**
3. Implement all 5 trigger detectors **including `morning_check`** with IndexedDB query. **(Creativity, Inspiration.)**
4. Calibrate breath against manual count for 5 min; if RMSE > 2 BPM, retune sensor placement. **(Functionality / honesty.)**
5. Capture `fixtures/recorded-csi-session.jsonl` for the fallback path. **(Functionality.)**

### Day 5 — Tue Apr 28

1. Drop user-provided `affirmations.json` into `src/data/`; wire state-filtered random pick. **(UI/UX.)**
2. Port `AffirmationCard` + animation; build `BreathGuide` paced by live `breathing_rate_bpm`. **(UI/UX.)**
3. Build `MorningCheckCard` (queries IndexedDB + Supabase; renders 3-panel comparison). **(Inspiration — strongest demo moment.)**
4. Implement `?source=recorded` query flag (replay JSONL through the same contract). **(Functionality.)**
5. Wire IndexedDB session store. **(Functionality.)**

### Day 6 — Wed Apr 29 (FEATURE FREEZE EOD)

1. Wire Supabase 2-table schema (no auth, hardcoded user_id); insert `state_transitions` + `interventions` on every event. **(Functionality, Business Potential.)**
2. Trusted Witness button (`mailto:`). **(Inspiration.)**
3. Cross-browser pass (Chrome, Safari, Firefox; mobile viewport). **(UI/UX.)**
4. Build sensing-server release binary; upload as a GitHub Release artifact for judges. **(Functionality.)**
5. README quickstart + RuView attribution + license; run `npx @claude-flow/cli@latest security scan`. **(All.)**
6. **STRETCH only if EOD slack:** ADR-011 magic-link auth + RLS upgrade. Otherwise ship V1 with hardcoded user_id and call it out clearly in README + write-up.

**EOD Day 6: feature freeze.** No new features after midnight.

---

# 11. Day 7 Demo + Day 8 Buffer

### Day 7 — Thu Apr 30 (DEMO VIDEO + WRITE-UP — locked)

**90–120 second demo video script** (revised to centre on `morning_check`):

- **0:00–0:12 (the pain, voiceover, dim room)** — "Most of us don't notice we're getting stressed until we're already in it. By then the body has been shifting for 20 minutes. The mind names it last."
- **0:12–0:25 (the sensor reveal, close-up of Heltec board)** — "MindRefreshStudio is a small WiFi sensor that lives in your room. No camera. No watch. It reads your breath through the WiFi signals already in the air."
- **0:25–0:50 (live detection)** — Breath rises; state flips REGULATED → ACTIVATED. "Here, the sensor catches me starting to spiral. The state changes. The intervention surfaces — a cyclic sigh, peer-reviewed in *Cell Reports Medicine* in 2023."
- **0:50–1:10 (recovery trace)** — Breath descends; state flips to RECOVERING. "Two minutes later, the sensor witnesses the return. Not because I told it I felt better — because the data shows it."
- **1:10–1:35 (THE MORNING CHECK — strongest moment)** — Cut to next morning. The MorningCheckCard fades in: "Yesterday you went into activated 4 times. The last one was at 11:38 PM. This morning your breath is at 16 — your regulated baseline is 12. Want to talk about it?" Voiceover: "The body remembers. The next morning, the cost shows up. The app meets you there, no judgement."
- **1:35–1:55 (privacy promise + Supabase architecture for 5 s)** — "Raw signals never leave your device. The only thing that syncs is the labels — when you regulated, what helped. Powered by Supabase."
- **1:55–2:00 (close)** — "MindRefreshStudio. The body knows first. We just listen."

**Submission checklist:**

1. Working URL — `https://mindrefresh-studio.vercel.app/` (defaults to live; `?source=recorded` if no sensor reachable; `?dev=1` reveals a "force morning_check" button for live-demo iteration).
2. 2-minute Loom + YouTube unlisted backup.
3. ≤ 400-word write-up: problem, solution, architecture, novelty, RuView attribution, future work (HRV roadmap, 4-state polyvagal restoration, magic-link auth, HNSW, SONA personalisation).
4. Public GitHub repo with React app, ADRs 005–010, RuView attribution, Supabase migration.
5. README quickstart with live URL, recorded-fixture URL, hardware setup photo, license (MIT).
6. `src/data/affirmations.json` (user-provided).
7. Sensor wiring photo.
8. Privacy statement footer with the §3 promise verbatim.
9. RuView attribution paragraph.
10. Pre-built sensing-server release binary URL.

### Day 8 — Fri May 1 (buffer + submit by 12 PM ET)

- Final smoke test in incognito.
- Submit form by 12 PM ET (3-hour buffer to 3 PM hard deadline).
- Notify community channels.

---

# 12. ADRs to Write

In urgency order. The first four written **today (Day 3)**.

| ADR | Title | Decision | Day |
|---|---|---|---|
| **ADR-005** | Two-link architecture: ESP32 → sensing-server → SPA → Supabase | No Node middleman; browser owns trigger detection in a Web Worker; Supabase is the only cloud surface. | **Today** |
| **ADR-006** | HRV out of V1 | Sensing-server emits smoothed HR, not RR intervals; HRV from a 1 Hz HR series is meaningless. Adopted post-launch when 60-GHz radar is paired. | **Today** |
| **ADR-007** | Supabase V1 simplified: 2 tables, no auth, hardcoded user_id | Magic-link auth + RLS deferred to Day 6 stretch or post-buildathon. V1 ships shippable. | **Today** |
| **ADR-008** | Sensing-server upstream port and path locked | `ws://localhost:8765/ws/sensing`; UDP 5005. Verified `cli.rs` L16–20 and `main.rs` L4662. | **Today** |
| ADR-009 | Sensing-server build verdict on macOS | Pass / fail of the Day-3 risk gate; if fail, recorded-fixture-only mode. | Today, after gate |
| ADR-010 | 3-state breath-trajectory classifier (V1) | `regulated / activated / recovering`. 4-state polyvagal cut for V1; restored post-buildathon when motion + dwell tie-breakers ship. | Day 4 |
| ADR-011 | (Day 6 stretch) Auth + RLS upgrade | If Day 6 has slack: enable magic-link auth, RLS on both tables, switch from hardcoded user_id to `auth.uid()`. | Day 6 |

**ADRs deferred by V1 cuts:** the ones documenting HNSW retrieval, WebGPU rephraser, 8-dim wellness vector, 4-state polyvagal classifier, SONA personalisation, and the 6-table Supabase schema all move post-buildathon.

---

# 13. Test Plan (London-school, mock-first)

Five test files scaffolded **today**, all without ESP32 or sensing-server. Co-located under `tests/`.

| File | Contract under test | Mocked dependency |
|---|---|---|
| `tests/sensing/wsClient.spec.ts` | `Sensing.subscribe` — connects to `ws://localhost:8765/ws/sensing`, parses `SensingUpdate` JSON, exposes `{breathBpm, hrBpm, presence, motionBandPower, ts}` to subscribers. | `WebSocket` global (mock socket emits canned `SensingUpdate` frames). |
| `tests/sensing/vitalsRingBuffer.spec.ts` | 60 s ring buffer: rolling mean / slope; oldest sample evicted at capacity; pure function. | None. |
| `tests/state/stateRules.spec.ts` | 3-state classifier — REGULATED→ACTIVATED when breath > 14 BPM rising sustained 60 s; ACTIVATED→RECOVERING when descent > 0.5 BPM/min for 30 s; ≥5 s debounce. | `Date.now()` (fake timers); ring-buffer feature stub. |
| `tests/triggers/morningCheck.spec.ts` | `morning_check` fires when last presence > 6 h ago AND new presence detected; payload contains yesterdayCount, lastEventTs, todayBaseline, regulatedBaseline. | IndexedDB (`fake-indexeddb`); `Date.now()` (fake timers); Supabase client (canned rows). |
| `tests/intervention/affirmationFilter.spec.ts` | Given state=`activated`, returns one of the activated affirmations from `affirmations.json`; excludes last 5 shown. | Seeded `Math.random`; `affirmations.json` fixture. |

---

# 14. Risk Register (delta from doc 02 + V1 simplifications)

| # | Status | Reason |
|---|---|---|
| Doc 02 #1 (RuView build on macOS) | Severity Medium | `--no-default-features` skips OpenBLAS / torch / ort. |
| Doc 02 #5 (demo machine has no Rust toolchain) | Resolved by pre-built release binary on Day 6. |
| **NEW #13** | Doc 03 contradicts this doc; agents pattern-match the wrong file. | Mitigation: supersede banner + this doc's status header (§1). |
| **NEW #14** | Supabase free-tier auto-pause after 7 days inactivity. | Mitigation: tag project active during May 1–3 judging window; document re-wake step in README. |
| **NEW #18** | V1's hardcoded user_id means all judges see the same fictional history. | Accepted: documented in ADR-007 + README. The `morning_check` story still works because the demo data shows non-trivial history. |
| **NEW #19** | `morning_check` requires the user to have left and returned (> 6 h gap). | Mitigation: demo video pre-records the gap by replaying recorded fixture; live demo includes `?dev=1` flag with "force morning_check" button for fast iteration. |
| **NEW #20** | User-provided affirmation corpus may not arrive in time for Day 5 wiring. | Mitigation: ship a 12-entry placeholder corpus on Day 5 morning; swap to user file when delivered; corpus path is just a JSON file edit. |
| **REMOVED** "Supabase exfiltrates biometrics" | Removed by data classification (§3); vitals never leave the browser. |
| **REMOVED** "WebGPU absent on judge's machine" | Removed by cutting WebGPU rephrase from V1. |
| **REMOVED** "HNSW bundle size blows up" | Removed by cutting `@ruvector/core` from V1. |
| **REMOVED** "SONA MicroLoRA training time" | Removed by cutting `@ruvector/sona` from V1. |
| **REMOVED** "RLS misconfiguration leaks across users" | Removed by V1's no-RLS, hardcoded user_id approach (deliberately accepts single-user demo limitation). |
| Doc 02 #11 (single-builder fatigue) | Severity Medium (was High) — V1 cuts reduce code surface ~40%. |

---

# 15. Final Recommendation

This document is the source of truth from now on. `docs/02_research/03_research_plan.md` is superseded; doc 04's valid technical fixes are absorbed (port 8765, Web Worker, HRV out). Doc 04's "drop Supabase" recommendation is reversed: **Supabase stays, simplified to 2 tables with hardcoded `user_id` and no auth for V1**; magic-link auth + RLS upgrade is gated to Day 6 slack as ADR-011 stretch. The 4-state polyvagal classifier is cut from V1 and replaced with a simpler 3-state breath-trajectory model (regulated / activated / recovering); polyvagal restoration is post-buildathon. The 8-dim wellness vector, HNSW retrieval, WebGPU rephrasing, and SONA personalisation are all post-buildathon. **The `morning_check` trigger is restored — it is the single strongest demo moment.** Affirmation corpus is provided by user. Build on. Days 3–6 are runway; Day 7 is runway light; Day 8 is brake.

---

## References

- [Polyvagal Theory: Current Status (PMC12302812, 2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12302812/)
- [Porges 2009 — polyvagal theory adaptive reactions (PMC3108032)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3108032/)
- [Polyvagal Institute — What is Polyvagal Theory](https://www.polyvagalinstitute.org/whatispolyvagaltheory)
- [Yilmaz Balban et al. 2023 — Cell Reports Medicine, cyclic sighing](https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf)
- [Stanford Med — cyclic sighing news](https://med.stanford.edu/news/insights/2023/02/cyclic-sighing-can-help-breathe-away-anxiety.html)
- [Schmidt et al. 2018 — Introducing WESAD, ICMI '18](https://dl.acm.org/doi/10.1145/3242969.3242985)
- [Strategies for Reliable Stress Recognition (PMC11126126)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11126126/)
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Pricing — free-tier limits](https://supabase.com/pricing)
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/cli.rs` (lines 11–32 — port defaults)
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/main.rs` (lines 189–267, 4662, 4867 — `SensingUpdate` fields and WS route)
- `upstream/RuView/examples/stress/hrv_stress_monitor.py` (HRV thresholds — roadmap only)
- `docs/02_research/01_winning_strategy.md` (somatic affirmations corpus, polyvagal frame)
- `docs/02_research/02_ruview_integration_strategy.md` (RuView audit, decision flips)
- `docs/05_architecture/01_system_architecture.md` (DDD bounded contexts)

*End of canonical build plan v3 (post-V1-simplification, 2026-04-26).*
