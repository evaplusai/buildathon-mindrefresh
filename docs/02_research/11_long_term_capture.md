# 11. Long-Term Capture, Replay, and Trends — the Ruv-reuse roadmap

# 1. Status & Header

**Status:** Roadmap — V1.5 mostly post-buildathon. The "capture mode" wiring (Phase A) is a **conditional Day-6 stretch candidate** only if all Day-3-through-6 tasks are green AND ≥3 hours of slack remain after feature freeze. Otherwise it lands in V1.5 Phase A in week 1 post-buildathon. The trend-visualization page (Phase B) is post-buildathon week 1. RuVector temporal-tensor integration (Phase C) is post-buildathon month 1. **Nothing in this doc is allowed to displace Day 7 demo lock or Day 8 buffer.**

**Today:** Tue Apr 28 — Build Day 5 of 8. Submission Fri May 1 @ 3 PM ET. Day 7 (Thu Apr 30) locked for demo + write-up; Day 8 morning is buffer + submit. Doc 10 (custom server research) was not authored as a separate file; the methodology and tone of "vendor RuView, add a thin layer" comes from doc 02 (`docs/02_research/02_ruview_integration_strategy.md`) and doc 09 (`docs/02_research/09_v1_final_audit.md`).

**Builds on:** doc 05 canonical build plan (V1 source of truth), doc 02 RuView integration strategy (vendor-not-fork doctrine), doc 09 V1 final audit (post-cuts scope), DDD Memory context (privacy boundary), ADR-007 (Supabase shape).

---

# 2. Motivation — Why Multi-Day Capture

V1's morning_check is the strongest single demo moment, but it ships with two limitations the user has identified:

1. **Demo data depth** — V1 reads "yesterday's" rows from Supabase. With only one day of judging-window history, the comparison panel is shallow ("you went into activated 1 time yesterday"). Multi-day capture lets us pre-record a believable 7–14 day arc before submission and replay it as the demo's history.
2. **Product reality** — the actual user value of MindRefreshStudio compounds across days, not within a session. "Your body remembers" is the tagline. To prove it, the app needs to read its own past at week-scale.

Concrete demos this unlocks:

- **Sleep insight:** "your breath was elevated for 47 minutes between 02:14 and 03:01 last Tuesday — what was that?"
- **Baseline drift:** "your regulated baseline has shifted from 11.8 to 13.4 BPM over the last 7 days."
- **Activated-event correlation:** "Mondays show 2.3× the activated events vs. Saturdays."
- **Recovery latency trend:** "your average return-to-regulated time has dropped from 14 min to 6 min over two weeks of practice."
- **Future training data:** every captured session is unlabeled-supervision raw material for SONA per-user threshold calibration (post-buildathon ADR).

This doc spec'd **as a roadmap** so it cannot leak into V1 build hours; the only V1.5-Phase-A piece eligible for buildathon-week landing is the capture-mode CLI wiring (§7), and only under the explicit Day-6 slack condition.

---

# 3. RuView Recording API — What's Already There

This is the load-bearing finding. **RuView's sensing-server already records and replays the exact same `SensingUpdate` JSON our `wsClient.ts` parses.** We do not need to build a capture pipeline; we need to drive theirs.

### File evidence

`upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/recording.rs` — full recording subsystem (487 lines) with:

- `RECORDINGS_DIR = "data/recordings"` (line 31).
- `RecordingState` struct holding `active`, `session_id`, `file_path`, `frame_count`, `started_at`, optional `duration_secs` (lines 69–104).
- `maybe_record_frame(...)` called from the main CSI tick (lines 115–173). Auto-stops when `duration_secs` exceeded (lines 133–140). Appends one JSON line per frame.
- `start_recording` handler (lines 255–312) — accepts `{session_name, label, duration_secs}`, generates `{name}-YYYYMMDD_HHMMSS.csi.jsonl`, and writes a companion `.meta.json`.
- `stop_recording`, `list_recordings`, `download_recording`, `delete_recording` handlers (lines 314–425).
- Routes mounted at `/api/v1/recording/{start,stop,list,download/:id,:id}` (lines 432–442).

`upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/main.rs` — a **second** older implementation (which is what's actually wired today) at lines 614–622, 3035–3204, 4759–4928. The currently-running pipeline subscribes to `s.tx` (a `broadcast::Sender<String>`, line 555) which carries serialized `SensingUpdate` JSON (line 1787, 1925, 3833) — meaning **the recorder writes the exact same JSON that flows over the WebSocket**. This is the property our reuse plan depends on.

### CLI flag inspection

Verified by running `cargo run -p wifi-densepose-sensing-server --no-default-features -- --help` from `upstream/RuView/v2/`. **There is no `--record`, `--recording-dir`, `--replay`, or `--source recorded` flag.** Recording is purely runtime via REST endpoints. Source-mode flags are only `--source {auto, wifi, esp32, simulate}`. Our SPA's `?source=recorded` is a **client-side** affordance entirely (`web-app/src/services/wsClient.ts` lines 65–103) that fetches a JSONL fixture from `/fixtures/recorded-csi-session.jsonl` and re-emits it through the same callback path.

### Existing fixture format

`web-app/public/fixtures/recorded-csi-session.jsonl` is the V1 placeholder: 143 lines, 15,922 bytes, ~111 bytes/line, **flat shape** (`{ts, breathing_rate_bpm, heart_rate_bpm, presence, motion_band_power}`). Note: this is **not** the SensingUpdate shape — it is a hand-rolled minimum the V1 fixture path uses. `wsClient.ts` `toFrame()` (lines 28–48) accepts both shapes via field fallbacks. So multi-day recordings written by RuView's recorder (full SensingUpdate) and the legacy V1 fixture (flat) both replay correctly today, with no code change.

### What we inherit for free

- File format (JSONL, one SensingUpdate per line)
- Per-session metadata sidecar (`.meta.json` with `frame_count`, `file_size_bytes`, timestamps)
- Stop semantics: explicit POST or `duration_secs` auto-stop
- Disk write batching (BufWriter, flush every 100 frames per main.rs L3098–3112)
- Listing, download, delete REST endpoints (already serve the trends page's needs as-is)
- The format **already replays through our existing client path** because `wsClient.ts.toFrame()` was built to accept it

### What we'd write fresh

- Capture-mode subcommand in `scripts/sensor-up.sh` (a thin POST wrapper)
- Session-picker UI on the SPA (a `<select>` populated from `/api/v1/recording/list`)
- Trend-computation Web Worker (post-buildathon)
- Daily-summary blob generator (post-buildathon, optional)

---

# 4. Capture Strategy

| Question | Recommendation | Rationale |
|---|---|---|
| **Engine** | Drive RuView's REST recorder | Inherit format + integrity + replay. Zero-fork policy. |
| **File format** | JSONL of full `SensingUpdate` | Already what RuView writes; already what `wsClient.ts` parses. RVF deferred (§5). |
| **Granularity** | Per-day rotation, file-named `mindrefresh-YYYYMMDD.csi.jsonl` | Maps cleanly to "trends per day"; one file = one row in the time-of-day heatmap. |
| **Trigger** | **Presence-gated** by default; `--always` opt-in | Privacy-positive default: empty room = no disk write. Reduces storage 10–30× depending on occupancy. Implemented via a thin daemon wrapper that reads the `classification.presence` flag from the same WS feed and POST-toggles `/recording/start` and `/recording/stop`. |
| **Storage path** | `~/.mindrefresh/recordings/` (laptop home dir) | Out-of-repo, persists across `git clean`, gitignored implicitly. Repo path `web-app/recordings/` rejected because it tempts accidental commits of GBs of biometric data. |
| **Privacy fields** | Whitelist, not blacklist | Per Memory DDD invariant 1, raw vitals never leave device. Local recordings store the full SensingUpdate (it's local), but the **trend-summary blob** that *might* sync (§6) carries only state-distribution counts and timestamps — never breath series. |
| **Retention** | Rolling 30 days, oldest-deleted by a daily cron | At ~430 MB/day worst-case (§6), 30 days = 13 GB. A user can opt into 90 days; the README documents the disk cost. |

The presence-gating insight is the biggest privacy + storage win. Most users are not in the sensor's room 16 of 24 hours. Gating cuts the 13 GB/month estimate to ~2–4 GB/month for a typical bedroom-only deployment, which is what most demo users will have.

---

# 5. File Format Decision (JSONL vs RVF)

RuView ships two persistence formats. JSONL is the recording format. RVF (Ruv-Vector File / "RuView Vector Format" container) is a binary segmented container the server can `--load-rvf` and `--save-rvf` (`upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/rvf_container.rs`) — designed for trained models, not vital-sign sessions.

| Criterion | JSONL | RVF |
|---|---|---|
| Replay through our existing `wsClient.ts` | **Yes, today, no changes** | Would need a JS RVF parser (none exists) |
| Disk efficiency | Worst case ~5 KB/frame text | Binary, ~30–60% smaller |
| Streaming append | Native (`append_line`) | Requires segment header rewrites |
| Tooling | `jq`, `tail -f`, any text editor | Requires custom Rust binary |
| Cognitum-Seed compatibility | None | Native (RVF is the substrate) |
| Trend-page reads | Browser fetch + line-by-line JSON parse | Browser cannot read RVF without a WASM build |

**Recommendation: JSONL for V1.5.** The Cognitum-Seed advantage is real but irrelevant until we have a model to train *on* multi-day vitals — that's V2 month-1+ scope. For replaying single-user single-room data into a Web Worker for trend computation, JSONL's "open in any tool, fetch-and-parse from the browser" property is decisive. RVF gets revisited only when the trend page is feeding a `wifi-densepose-train` pipeline — at which point we add an RVF *export* path that reads the JSONL archive and packages it. No conversion is needed for the V1.5 trend visualization.

---

# 6. Storage Architecture (4 tiers)

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1 — Raw recordings (LOCAL ONLY, never syncs)               │
│   ~/.mindrefresh/recordings/mindrefresh-YYYYMMDD.csi.jsonl      │
│   ~/.mindrefresh/recordings/mindrefresh-YYYYMMDD.meta.json      │
│   Source: RuView /api/v1/recording/start (presence-gated)       │
│   Size: ~430 MB/day worst case @ 1 Hz SensingUpdate full JSON   │
│         ~50–100 MB/day typical (presence-gated, 4–6 hr/day)     │
│   Retention: rolling 30 days (configurable, README-documented)  │
└─────────────────────────────────────────────────────────────────┘
                           │ replay via ?source=recorded&session=…
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 2 — IndexedDB session events (existing, unchanged)         │
│   transitions, interventions, feedback, whats_alive, meta       │
│   Source: triggerWorker derives these from Tier 1 OR live       │
│   Size: ~5–20 KB per session (durable since V1)                 │
│   Privacy: local-only, never syncs                              │
└─────────────────────────────────────────────────────────────────┘
                           │ Memory.appendTransition / appendIntervention
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 3 — Supabase (existing, unchanged)                         │
│   state_transitions, interventions (ADR-007 schema)             │
│   Source: Tier 2 → cloudSync.ts                                 │
│   Privacy: state labels + affirmation IDs only, structural      │
└─────────────────────────────────────────────────────────────────┘
                           │ NEW: optional opt-in nightly summary
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 4 — Daily summary blobs (NEW, opt-in, V1.5 Phase B)        │
│   Local: ~/.mindrefresh/summaries/YYYYMMDD.json                 │
│   Optional cloud table: daily_summaries                         │
│   Fields: date, state_breakdown_minutes, regulated_baseline,    │
│           activated_event_count, recovery_latency_p50           │
│   No raw vitals; no breath series; no user-typed text           │
│   Size: ~200 bytes/day (negligible)                             │
└─────────────────────────────────────────────────────────────────┘
```

**Sizing math.** Real `SensingUpdate` JSON includes `nodes[].amplitude` vectors of 52–114 subcarriers (~600 B–1 KB per node), `features`, `classification`, `vital_signs` — measured in production at 3–5 KB per frame at the canonical 10 fps tick rate. At 1 Hz emission (which the server smooths to), expect 3–5 KB × 86,400 = **260–430 MB/day** worst case. The flat V1 fixture format (~111 B/frame) is an order of magnitude smaller but loses the multi-node signal-field info; the trend page does not need that — so a future optimization is to record a "thin" JSONL variant filtering to just `{ts, vital_signs, classification, features.motion_band_power}` ≈ 200–400 B/frame ≈ **20–35 MB/day**. We file this as Phase-B work, not Phase-A.

The Tier-4 daily-summary blob is the only new persistence; everything else reuses Tiers 1–3 verbatim.

**Migration path** for the existing fixture: `web-app/public/fixtures/recorded-csi-session.jsonl` stays exactly where it is (it is the no-network demo fallback). New captures go to `~/.mindrefresh/recordings/` outside the repo. The dashboard's session picker (Phase B) lists both: the bundled fixture as `demo` and any user-captured sessions as `mindrefresh-YYYYMMDD`.

---

# 7. Replay & Simulation

### CLI surface

Two subcommands added to `scripts/sensor-up.sh`. Phase A.

```bash
# start a presence-gated capture daemon (sensing-server already running)
./scripts/sensor-up.sh record [--always] [--label tag]

# stop the daemon (also auto-stops on SIGINT)
./scripts/sensor-up.sh record-stop

# list local recordings via /api/v1/recording/list
./scripts/sensor-up.sh sessions

# replay a session by id at 60× speed
./scripts/sensor-up.sh play mindrefresh-20260427 --speed 60x

# step / loop / scrub variants
./scripts/sensor-up.sh play <id> --step 30s
./scripts/sensor-up.sh play <id> --loop
```

Implementation note: `record` is a Python or Node helper that subscribes to `ws://localhost:8765/ws/sensing`, watches `classification.presence`, and POSTs `/api/v1/recording/start|stop`. Roughly 60 lines. `play` reads the JSONL, accelerates timestamps, and serves it to the SPA via a tiny static file server *or* simply prints the path so the user pastes it into a `?source=recorded&file=…` URL.

### UI surface

Two new affordances on the existing dashboard, both hidden behind `?dev=1`:

- **Session picker** (`SessionPicker.tsx`, ~50 lines): a `<select>` populated from `/api/v1/recording/list`, plus the bundled `demo` fixture. Emits the chosen session into the URL as `?source=recorded&session=<id>`.
- **Speed control** (`PlaybackControls.tsx`, ~40 lines): play/pause/scrub/×60. Calls into the existing `wsClient.startRecorded()` with a `speedFactor` parameter (a one-line addition to `wsClient.ts`).

### Compatibility invariant

Replayed frames flow through the same `wsClient.subscribe()` callback as live frames. The Worker, classifier, ring buffer, trigger detectors, and Memory context cannot tell the difference. This is the canonical Memory DDD invariant for the recorded-fixture path and remains untouched.

A separate `/replay` page is **not** recommended for V1.5 — it adds router complexity and duplicates dashboard chrome. The dashboard with `?source=recorded&session=…&speed=60x` *is* the replay page.

---

# 8. Trend Visualization Spec

Five trends. All read from Tier 4 daily-summary blobs (computed once, cached) when available, with a fallback path that scans Tier 2 (IndexedDB) on first load.

| # | Trend | ASCII shape | Reads from | Computed by |
|---|---|---|---|---|
| 1 | **State distribution per day** | Stacked bars, 7–14 cols | Tier 4 summaries | Worker (one pass over yesterday's events at 23:55 local) |
| 2 | **Time-of-day heatmap** | 14 rows × 24 cols, color = dominant state | Tier 4 summaries (binned hourly) | Worker |
| 3 | **Breath baseline drift** | Line chart, 7-day EWMA | Tier 4 summary `regulated_baseline` field | Worker |
| 4 | **Activated-event count + morning_check correlation** | Twin-axis bar+line | Tier 4 summary `activated_event_count` + Tier 2 morning_check rows | Worker |
| 5 | **Recovery latency p50** | Line chart with band | Tier 4 summary `recovery_latency_p50` | Worker |

**Sleep-window proxy** and **cross-session similarity** are explicitly cut from V1.5 Phase B. The first requires reliable presence-gating during low-motion sleep states which currently has high false-negative risk; the second requires RuVector embedding integration and is a Phase C item.

### ASCII mock — time-of-day heatmap

```
          00 02 04 06 08 10 12 14 16 18 20 22
Mon Apr 27  R  R  R  R  R  R  G  G  A  G  R  R
Tue Apr 28  R  R  R  R  G  G  G  A  A  G  R  R
Wed Apr 29  R  R  R  R  G  R  G  G  G  G  R  R
Thu Apr 30  R  R  R  R  G  G  G  R  G  G  R  R
                                  └─ A = activated
                                     G = recovering
                                     R = regulated
                                     space = no presence
```

### Implementation

A single `/trends` route (lazy-loaded) with the five charts as composable React components reading from a `useTrendData()` hook. Computation lives in `src/workers/trendWorker.ts` to keep the main thread free during multi-day scans. **Charting library:** roll-our-own SVG. Five charts × ~80 lines each is ~400 lines of code, less than `recharts`'s peer-dep bloat (it pulls `d3-shape`, `d3-scale`, `d3-array` totalling ~80 KB gzipped). The shadcn ecosystem does not pin a charting lib; bundle minimalism beats convenience for V1.5.

### RuVector relevance, honest assessment

`ruvector-temporal-tensor`'s `CompressedCsiBuffer` is the right primitive *if* we ever need to load multi-week raw CSI into memory at once for cross-session computation. For the five trends above, daily summaries fit in ~3 KB total for a 14-day window — `Array.from()` and `forEach()` are fine. **Skip RuVector for V1.5.** Revisit when (a) per-user threshold calibration starts reading raw breath series, or (b) cross-session similarity ("find days that felt like today") is added. That is post-buildathon month 1+ scope.

`ruvector-mincut` is irrelevant here — it's a graph-cut algorithm for subcarrier selection, not time-series.

---

# 9. Reuse Table

| Component | Source | Status |
|---|---|---|
| File format (JSONL of `SensingUpdate`) | `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/recording.rs` L57–64; main.rs L3062, L3105 | **REUSE FROM RUVIEW** |
| Recorder daemon (frame appender, BufWriter) | `recording.rs::maybe_record_frame` L115–173; `main.rs` L3096–3134 | **REUSE FROM RUVIEW** |
| Auto-stop by duration | `recording.rs::maybe_record_frame` L133–140 | **REUSE FROM RUVIEW** |
| Per-session `.meta.json` sidecar | `recording.rs::stop_recording_inner` L211–217 | **REUSE FROM RUVIEW** |
| List / download / delete API | `recording.rs::routes()` L432–442 | **REUSE FROM RUVIEW** |
| Replay engine (JSONL → `VitalsFrame` callbacks) | `web-app/src/services/wsClient.ts::startRecorded` L65–103 | **REUSE FROM V1** |
| `?source=recorded` URL handling | `wsClient.ts::start` L105–110 | **REUSE FROM V1** |
| State classifier on replayed frames | `web-app/src/workers/triggerWorker.ts` (V1) | **REUSE FROM V1** |
| IndexedDB session event store | `web-app/src/services/sessionStore.ts` (V1) | **REUSE FROM V1** |
| Supabase write client | `web-app/src/services/cloudSync.ts` (V1) | **REUSE FROM V1** |
| Presence-gated start/stop wrapper | None — bridges `classification.presence` to `/api/v1/recording/{start,stop}` | **WRITE FRESH** (~60 lines, `scripts/record-daemon.mjs`) |
| `record` / `play` subcommands in `sensor-up.sh` | None | **WRITE FRESH** (~40 lines added to existing script) |
| Speed-up factor for replay | None — extension of `startRecorded` | **WRITE FRESH** (~5 lines, `wsClient.ts`) |
| Session picker UI | None | **WRITE FRESH** (~50 lines, `SessionPicker.tsx`) |
| Trend Worker | None | **WRITE FRESH** (~200 lines, Phase B) |
| Daily summary computation | None | **WRITE FRESH** (~80 lines, Phase B) |
| Five SVG trend charts | None | **WRITE FRESH** (~400 lines total, Phase B) |
| Cross-session similarity | `ruvector-temporal-tensor` | **DEFER to Phase C** |

The first column dominates by line count — RuView gives us roughly 800 lines of recording infrastructure for free. Net new code for Phase A is ~100 lines; for Phase B is ~700 lines; Phase C is open-ended.

---

# 10. Implementation Plan (3 phases)

### Phase A — Capture mode wiring (CONDITIONAL Day 6 stretch OR week 1)

**Scope:**
- `scripts/record-daemon.mjs`: ~60-line Node script that subscribes to `ws://localhost:8765/ws/sensing`, watches `classification.presence`, POSTs `/api/v1/recording/start` on rising edge with day-stamped `session_name`, POSTs `/recording/stop` on 5 min sustained absence.
- `sensor-up.sh record` / `record-stop` / `sessions` subcommands: ~40 lines.
- README quickstart paragraph: how to enable, where files land, how to delete.
- `~/.mindrefresh/recordings/` symlinked into RuView's `data/recordings/` cwd via `--ui-path`-adjacent override or a startup-time `mkdir + ln -s`. (Currently RuView writes to `data/recordings/` relative to the cwd from which `cargo run` is invoked — `scripts/sensor-up.sh` already invokes from `upstream/RuView/v2/`, so we add a one-liner that ensures the symlink exists.)

**Time estimate:** 1–2 days (single builder, no swarm).

**Exit criteria:**
- `./scripts/sensor-up.sh record` writes a JSONL to `~/.mindrefresh/recordings/` while the user is in the room.
- `./scripts/sensor-up.sh sessions` prints the session list from `/api/v1/recording/list`.
- Replaying a captured session through `?source=recorded` works without modifying `wsClient.ts` (validates the format invariant).

**What changes:** two new files (`scripts/record-daemon.mjs`, README section), one extended file (`scripts/sensor-up.sh`). Zero changes to `web-app/src/`.

**Day-6 gate:**
> Phase A may land before submission **only if** all of: Day-3-through-6 plan items are green; feature freeze still holds at EOD Day 6; ≥3 hours uncommitted slack remain; no failing test on `main`. Otherwise it ships post-buildathon.

### Phase B — Trend visualization page (post-buildathon week 1)

**Scope:**
- `src/workers/trendWorker.ts`: scans Tier 1 JSONL files from a Tier-4 summary cache.
- `src/services/dailySummary.ts`: nightly job (or first-load-of-day) that computes 5–7 metrics per day and writes `~/.mindrefresh/summaries/YYYYMMDD.json`.
- `src/routes/trends.tsx`: new lazy-loaded route.
- `src/components/trends/{StateBars,TimeOfDayHeatmap,BaselineDrift,ActivatedCount,RecoveryLatency}.tsx`: five SVG charts.
- `src/components/SessionPicker.tsx` + `PlaybackControls.tsx`: dashboard replay affordances (could overlap with Phase A if scope expands).

**Time estimate:** 3–4 days (single builder).

**Exit criteria:**
- `/trends` renders all 5 charts from a 14-day fixture.
- Worker scan does not block the UI thread (postMessage cadence ≤ 200 ms; main thread idle ≥90% during scan).
- Privacy-test passes: zero `fetch` to non-`*.supabase.co` origins; daily-summary cloud writes carry no breath series.

**What changes:** ~7 new files under `src/`; one new test under `tests/`. No backend changes.

### Phase C — RuVector temporal-tensor + cross-session similarity (post-buildathon month 1+)

**Scope:** integrate `ruvector-temporal-tensor::CompressedCsiBuffer` for compressed multi-day vital-sign storage; add `ruvllm`-driven similarity search ("days that felt like today"). Out of scope for any buildathon-adjacent decision.

**Time estimate:** 5–10 days. Requires a fresh ADR and is gated on a real product hypothesis ("does cross-session similarity actually improve intervention selection?") — until that question is answered yes, this phase is roadmap-only.

---

# 11. Privacy Delta

**V1 baseline (ADR-007 + Memory DDD).** Single short demo session. Privacy invariant: state labels + affirmation IDs leave the device; raw vitals never do.

**Multi-day delta — what changes.** A 14-day local recording at presence-gated typical occupancy is ~700 MB–1.5 GB of full-fidelity CSI-derived vital-sign series. That is several orders of magnitude more sensitive than V1's ephemeral RAM-only state. The threat model expands:

| Threat | V1 | V1.5 (multi-day capture) |
|---|---|---|
| Sensor-side compromise | Low (RAM only) | **Medium** — disk has weeks of breath/HR/presence data |
| Repo-side leak | None (no repo data) | **None if `~/.mindrefresh/` stays out of repo** (enforced) |
| Cloud-side leak | Negligible (state labels) | Unchanged — Tier 1 never syncs; Tier 4 carries summaries only |
| Backup / Time Machine inclusion | N/A | **Medium** — `~/.mindrefresh/` will be in default macOS Time Machine sets |

**Rules.**

1. **Tier 1 never leaves the device.** Hard rule. No "share recording with developer" feature in V1.5. If telemetry is ever added, it's Tier 4 only.
2. **Tier 4 syncs only what V1 already syncs in spirit:** counts, durations, single-sample baselines. No breath series. No HR series. No raw motion power series. This is the same structural-privacy doctrine as V1, applied at day-scale.
3. **README documents disk path** so users know what to encrypt / exclude from backups / shred on uninstall.
4. **`~/.mindrefresh/` lives outside `$HOME` cloud-sync folders** (Dropbox, iCloud Drive). README warns explicitly.
5. **Uninstall path:** `./scripts/sensor-up.sh purge` deletes Tier 1 + Tier 4 local data with a confirmation prompt. Phase A scope.

The DDD Memory context invariants 1–4 (no raw vitals to Supabase, no user-typed text to Supabase, hardcoded `user_id`, structural-not-toggle privacy) **all apply to Phase B summaries unchanged.** Phase B does not introduce a new Supabase table by default; if `daily_summaries` is added, it requires a new ADR and the schema is enumerated in advance.

---

# 12. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| LT-1 | Disk fills (30 days × 430 MB/day worst case = 13 GB) | Medium | Default presence-gated; rolling 30-day retention; README cost-disclosure; `purge` subcommand |
| LT-2 | Phase A leaks into Day 6 and displaces V1 ship | **High if not gated** | Strict 3-hour slack gate; Phase A scope-frozen at this doc's §10; can be cancelled mid-implementation without affecting V1 |
| LT-3 | JSONL format drift between `recording.rs` and `main.rs` recorder paths | Low | Single source-of-truth check in Phase A acceptance test: replay a 1-hr capture through V1 worker, assert ≥1 state transition produced |
| LT-4 | `?source=recorded` doesn't accept full SensingUpdate from RuView's recorder | Already handled | `wsClient.ts::toFrame()` already accepts both shapes (lines 28–48); covered by `tests/sensing/wsClient.spec.ts` |
| LT-5 | Trend computation blocks UI thread on first 30-day load | Medium | Phase B mandates Web Worker (`trendWorker.ts`); incremental summary cache means 30-day → 30 × 200-byte read on warm cache |
| LT-6 | Privacy regression — a developer adds "share recording" feature without ADR | Medium | DDD Memory context invariants explicitly extended in this doc; README + structural-privacy test in Phase B (mirror of `tests/memory/sessionStore.spec.ts`) |
| LT-7 | Multi-day raw recording on a shared laptop exposes another user | Medium | README: single-user-laptop assumption documented; `~/.mindrefresh/` permissions chmod 700 in Phase A bring-up |
| LT-8 | RuView's recorder format changes upstream and breaks our reader | Low | Vendored `upstream/RuView/` is pinned; upstream bumps require a deliberate update + this doc's reuse-table revisit |
| LT-9 | RVF chosen now then reversed | N/A | Rejected here in §5 with named criteria; non-issue |
| LT-10 | Trends page bundle bloat | Low | Roll-our-own SVG (~400 lines) chosen over `recharts` (~80 KB gzipped); enforced by Phase B bundle-size budget |

---

# 13. Decision Recommendation

**Top picks.**

- **Format:** JSONL of full `SensingUpdate`, written by RuView's existing recorder (`recording.rs` + `main.rs` recording paths).
- **Storage path:** `~/.mindrefresh/recordings/` — out of repo, chmod 700, gitignored implicitly.
- **Trigger default:** presence-gated; `--always` opt-in.
- **Granularity:** per-day file rotation.
- **Retention:** rolling 30 days, configurable.
- **Replay:** extend existing `?source=recorded` path with `&session=<id>&speed=<n>x`. No new page.
- **Charting:** roll-our-own SVG; reject `recharts`/`visx` for bundle minimalism.
- **RuVector temporal-tensor:** defer to Phase C; not justified for V1.5 trend volumes.

**One-paragraph schedule call.** Phase A (capture-mode wiring, ~100 net new lines, ~1–2 days) is a worthy Day-6 stretch *only if* all of: Day-3-through-6 plan items are green by Day-6 morning; feature freeze still holds; ≥3 hours uncommitted slack remain; no failing test on `main`. Today is Day 5 and the V1 demo loop is still being polished — realistically this gate will not clear, and Phase A should ship in **week 1 post-buildathon** alongside an updated README. Phase B (trend page, ~700 net new lines, ~3–4 days) is week 1 post-buildathon regardless. Phase C is roadmap-only and does not influence the buildathon submission. **Wire capture-mode next week, not this week.** The Day-7 demo lock and Day-8 buffer are sacred.

---

# 14. References

- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/recording.rs` — the load-bearing finding (full recording subsystem, 487 lines)
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/main.rs` L189–240 (`SensingUpdate` struct), L555 (broadcast channel type), L614–622 (recording state fields), L3035–3204 (recording handlers as wired today), L4759–4928 (mount points)
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/cli.rs` L1–106 — full CLI flag enumeration (no `--record` / `--replay` flags)
- `web-app/src/services/wsClient.ts` L28–48 (`toFrame` shape-bridging), L65–103 (`startRecorded` JSONL replay), L105–121 (`start` source dispatch)
- `web-app/public/fixtures/recorded-csi-session.jsonl` — V1 placeholder; 143 lines × ~111 B
- `scripts/sensor-up.sh` — current bring-up; Phase A extends with `record`, `record-stop`, `sessions`, `play`
- `docs/02_research/05_canonical_build_plan.md` §3 (data classification), §8 (Supabase schema), §9 (reuse map)
- `docs/02_research/02_ruview_integration_strategy.md` (vendor-not-fork doctrine)
- `docs/02_research/09_v1_final_audit.md` (post-cuts scope, methodology precedent)
- `docs/ddd/04_memory_context.md` (privacy invariants 1–4, structural privacy)
- `docs/adr/ADR-007-supabase-v1-simplified.md` (V1 schema constraints — Tier 4 must respect these)
- `upstream/RuView/CLAUDE.md` (RuVector ecosystem hooks: `ruvector-temporal-tensor`, `ruvector-mincut`)
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/rvf_container.rs` — RVF format (rejected for V1.5 in §5)

*End of long-term capture roadmap (build day 5, 2026-04-28).*
