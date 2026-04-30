# ADR-016: Reflect agent swarm uses Ruv 3-tier model routing + ReasoningBank trajectories

**Status:** Accepted
**Date:** 2026-04-30
**Build Day:** Post-V1 / Dashboard v2 sprint
**Implementation:** shipped 2026-04-30 in Sprint B; Vercel Edge Function at `web-app/api/reflect.ts`; on-device Pattern Scorer with regex fallback; @anthropic-ai/sdk@0.91.1; SSE stream with synthetic emit on fallback path; 4s per-agent timeout. Privacy invariant + aidefence + voice rules mechanically tested across 21 unit tests + 2 e2e.
**Supersedes:** (none)
**Superseded by:** (none)

## Context

The Dashboard v2 spec (`docs/03_designs/dashboard-v2_spec.md` §"The agent
swarm — current vs. real") introduces a new core feature: a **Reflect**
card that runs three agents in parallel on user-typed text and updates the
dashboard with their joint output.

- **Agent 1 — Pattern Scorer:** classifies the text against 8 categories
  (urgency, catastrophizing, rumination, exhaustion, overwhelm,
  minimization, perfectionism, isolation). Emits `{patterns:[{key, score,
  evidence}], raw_observations}`.
- **Agent 2 — State Mapper:** combines Agent 1's output with the latest
  sensor signal to choose a `DashboardState` (per ADR-015).
- **Agent 3 — Reframe Writer:** produces a single 2–4 sentence
  observational reframe in the MindRefresh voice (no exclamation, no
  corrective tone, italics on the observational verb phrase).

The reference HTML mocks all three with deterministic browser-side regex
+ random pick. The spec asks for real model calls behind the same UI.

The proximate question is "how do we wire real models," but the deeper
question is **what tier each agent should run on**, **how its trajectory
is logged**, and **what we MUST NOT rebuild from scratch**.

`CLAUDE.md` already commits the project to a 3-tier model routing
discipline (ADR-026 row in CLAUDE.md):

| Tier | Handler | Latency | Cost | Use Cases |
|---|---|---|---|---|
| 1 | Agent Booster (WASM) | <1ms | $0 | Simple transforms |
| 2 | Haiku | ~500ms | $0.0002 | Simple tasks, complexity < 30% |
| 3 | Sonnet/Opus | 2–5s | $0.003–0.015 | Complex reasoning, complexity > 30% |

And the project's MCP toolkit (already wired via `claude-flow` and
`agentic-flow`) exposes:

- `embeddings_generate` / `embeddings_search` (ONNX 384-dim, on-device)
- `ruvllm_*` (WebGPU LLM inference)
- `ruvllm_microlora_*` / `ruvllm_sona_*` (per-user adaptation)
- `hooks_intelligence_trajectory-*` (ReasoningBank trajectory recording)
- `hooks_route` (3-tier model router)
- `agentdb_*` (HNSW + DiskANN vector store, also pattern store)
- `agentdb_pattern-store` / `agentdb_pattern-search` (used elsewhere in
  this project — see `docs/agents/code-review-swarm.md`)
- `aidefence_scan` / `aidefence_is_safe` (prompt-injection guard for
  user-typed input)

We have no business reimplementing any of these. This ADR locks the agent
swarm to those tools.

## Decision

### Tier assignment per agent

| Agent | Tier | Where it runs | Why |
|---|---|---|---|
| Pattern Scorer | **1 (WASM)** with optional Tier-2 fallback | Browser, on-device, via `embeddings_generate` against an ONNX classification head OR a deterministic-regex baseline | Pure feature extraction; sub-ms; the spec's 8 categories are pre-defined; embeddings + cosine to seed phrases hit the same shape as the regex mock at higher fidelity. NEVER hits cloud unless `?cloud=1` flag. |
| State Mapper | **2 (Haiku)** | Server-side via `hooks_route` with model=haiku, OR fully on-device via `ruvllm_chat_format` if WebGPU available | Combines two structured inputs into one structured output. Low complexity. ~30 input tokens, ~80 output. Privacy-acceptable for cloud because input is already abstract (pattern scores + state, no raw user text). |
| Reframe Writer | **3 (Sonnet)** | Server-side via `hooks_route` with model=sonnet | Voice-quality matters; observational tone is hard for smaller models; user reads this output directly. Cost per call ≈ $0.005; acceptable. |

The router is `mcp__claude-flow__hooks_route` (already in the MCP
toolkit). It accepts `{task: string, complexity?: number}` and returns the
chosen handler. The `task` field includes a system-prompt hint identifying
the agent (`"agent: pattern-scorer"` etc.) so the router can specialise on
prior `hooks_model-outcome` data via SONA. We pass through.

### Privacy invariant (load-bearing)

Per the V1 ADR-007 / build plan §3 data-classification framing:
- **Raw user text** flows ONLY through Agent 1 (Pattern Scorer), which
  runs on-device for this exact reason.
- **Agent 2 receives only the abstract output** of Agent 1
  (`{patterns: [...]}` + sensor state), never the raw text.
- **Agent 3 receives Agent 1's output + Agent 2's state**, never the
  raw text. The reframe is generated *about the linguistic patterns*, not
  *from the user's words*.

The system prompts must enforce this: Agent 2's prompt never receives the
raw text. Agent 3's prompt never receives the raw text. This is
mechanically tested in `tests/reflection/privacy.spec.ts` by mocking the
`hooks_route` call and asserting no agent input string contains the raw
user input string.

The user-typed text is also passed through `aidefence_is_safe` before
ingestion to block prompt-injection attempts; if it fails the safety
check, the swarm short-circuits with a polite error. (Per CLAUDE.md
"Security Rules" — input validation at boundaries.)

### Streaming pattern

The reference HTML uses `setTimeout` to fan out the 3 agent statuses. The
real version uses **Server-Sent Events from a Vercel Edge Function** that
runs the 3 calls in parallel server-side and streams progress per agent
back to the SPA:

```
POST /api/reflect  { text }
  → SSE: { agent: 1, status: 'thinking' }
  → SSE: { agent: 1, status: 'done',    payload: {...} }
  → SSE: { agent: 2, status: 'thinking' }
  → SSE: { agent: 2, status: 'done',    payload: {...} }
  → SSE: { agent: 3, status: 'thinking' }
  → SSE: { agent: 3, status: 'done',    payload: {...} }
  → SSE: { kind: 'complete', durationMs }
```

The `/api/reflect` endpoint is a single Vercel Edge Function (≤100 LOC)
that internally calls `hooks_route` 3× via `Promise.all` and forwards
events. The endpoint never logs the raw text (privacy). It does log the
trajectory via `hooks_intelligence_trajectory-start` /
`-step` / `-end` so ReasoningBank captures the run for self-learning.

### Hybrid fallback (per spec §"Architecture options" Option 3)

Each agent call is wrapped in a `Promise.race` against a 4 s timeout that
resolves to a deterministic mock (the same `scoreText` / `pickState` /
`pickReframe` from the reference HTML). If the network blips or a model
is slow, the demo never breaks. The UI never shows "ERROR" — it shows the
mocked output and tags the response card with `data-fallback="true"` so
e2e tests can verify the path.

```ts
const result = await Promise.race([
  realCallViaMcpRouter(...),
  new Promise(resolve => setTimeout(() => resolve(mockFor(text, agent)), 4000))
]);
```

### What we MUST NOT rebuild

Per pi.ruv.io guidance and this project's existing toolkit:

| Concern | Reuse this | Do NOT build |
|---|---|---|
| Vector embeddings | `embeddings_generate` (ONNX, 384-dim) | A bespoke embedding model |
| Vector search | `embeddings_search` / `agentdb_pattern-search` (HNSW) | A linear scan over patterns |
| Pattern store | `agentdb_pattern-store` | A custom JSON file of patterns |
| Model routing | `hooks_route` | A custom dispatcher with hardcoded model names |
| Trajectory logging | `hooks_intelligence_trajectory-*` | A custom analytics pipeline |
| Per-user adaptation | `ruvllm_microlora_adapt` / `ruvllm_sona_adapt` | A bespoke LoRA fine-tune |
| Prompt-injection guard | `aidefence_is_safe` | A regex blocklist |
| WebGPU LLM (if used for State Mapper on-device) | `ruvllm_chat_format` + `ruvllm_generate_config` | A custom WASM inference shim |
| Local model SDK | `mcp__claude-flow__ruvllm_*` family | `transformers.js` direct |

Anything in the table above is the cheap path. New code only fills the
gaps the toolkit doesn't already cover.

### Self-learning loop (post-V2)

Each Reflect run produces a trajectory record. The trajectory contains
(in this order, recorded via `hooks_intelligence_trajectory-step`):

1. Pattern Scorer output (sanitized — no raw text)
2. State Mapper output + which dashboardState the sensor said at the same
   moment (so the agent's accuracy is measurable)
3. Reframe text + a hash of it
4. User feedback (helped/neutral/unhelpful — 3-tap, captured from the
   existing AffirmationCard) → `hooks_model-outcome`
5. `verdict` field: did the user act on the reset suggestion within 5
   minutes? (queryable from `sessionStore` after the fact)

Once N≥200 trajectories accumulate per user, `ruvllm_sona_adapt` can
fine-tune the Reframe Writer's tone toward what that user's feedback
signals as "helpful." This is post-V2 work; ADR-016 only commits to the
*recording*, not the *training*.

### Where the swarm runs (for V2 hackathon)

V2 ships with the agent swarm wired through:
- Browser-side: `Agent 1` via `embeddings_generate` (always on-device)
- Edge function: `Agent 2` (Haiku) and `Agent 3` (Sonnet) via the
  Anthropic SDK behind `/api/reflect` (Vercel Edge)
- The edge function uses `hooks_route` to log the routing decision but
  calls the Anthropic SDK directly for the actual inference (no MCP
  bridge inside an edge function — keep the cold start cheap)
- ReasoningBank trajectory recording happens in the browser (via the
  `mcp__claude-flow__hooks_intelligence_trajectory-*` MCP bridge) so the
  edge function stays stateless

> **Why not run all three on-device with `ruvllm`?** WebGPU is great for
> Agent 2 in modern browsers, but Agent 3's reframe quality from a
> ~3B-parameter local model isn't there yet. Demo reliability is the
> rubric here; cloud Sonnet for the user-visible text is the right
> tradeoff. ADR-018 (post-buildathon, when local 7B+ ships in WebGPU at
> demo-acceptable latency) reverses this for full-on-device privacy.

## Consequences

### Positive

- The user gets a real swarm demo with real reasoning, not a regex toy.
- The architecture is one Edge Function (≤100 LOC), one new browser
  service (`reflectClient.ts`, ≤120 LOC), one new React component
  (`ReflectCard.tsx`, the existing reference's structure ported), and
  ~6 new MCP-tool calls. Everything else is reuse.
- The privacy invariant is mechanically encoded in the system prompts
  and the test suite. The "raw signals never leave the home" framing
  from the marketing page (ADR-014) holds — even though Agent 2 and 3
  call cloud, they never see the raw user text.
- The hybrid fallback means a flaky network never breaks the live demo.
- ReasoningBank trajectories are captured from day one, so when
  `ruvllm_sona_adapt` becomes practical for this domain, the training
  data is already there.

### Negative

- A Vercel Edge Function is one new piece of infrastructure (vs. the
  V1 SPA-only deploy). One env var (`ANTHROPIC_API_KEY`) is added on
  Vercel; we do not bring the key into the SPA.
- Cloud cost: ~$0.005 per reflect submit. At 100 demo runs/day this is
  negligible; at scale, ADR-018 (post-buildathon) moves Agent 3 to local.
- The agent's State Mapper output is *advisory* — the dashboard's
  displayed state always comes from the sensor (per ADR-015). New users
  who don't read the agent log won't notice; experts may find the
  divergence confusing. Documented in DDD-06 §Voice rules.

### Neutral

- Agent 1 lives in `web-app/src/services/reflect/agent1-pattern-scorer.ts`
  as on-device code. Tests run without network. No infrastructure cost.
- The reference HTML's deterministic mocks become the *fallback* path,
  not the *primary* path. Same code, different status.
- The existing `affirmationFilter.ts` (V1 Intervention) and
  `pickAffirmation` are NOT replaced. The Reflect swarm is a *new*
  intervention surface; the existing morning_check / acute_spike
  pipelines continue to use the curated `affirmations.json` corpus. The
  Reframe Writer generates fresh reframes for the *Reflect-card* surface
  only.

## Alternatives Considered

- **Run all three agents from the browser via direct Anthropic SDK
  calls.** Rejected per spec §"Option 1": leaks API keys to the
  browser. Acceptable for a hackathon demo only if there's no time for
  an Edge Function. We have time.
- **Run all three agents on a Cloudflare Worker / FastAPI backend.**
  Vercel Edge is a cleaner match for our existing deploy story; same
  pattern, lower friction.
- **Skip the swarm; use a single Sonnet call with all three prompts
  chained.** Rejected: the swarm IS the demo. Three agent cards
  animating in parallel is the visible feature. A monolithic prompt
  removes the visual story.
- **Use OpenAI / Gemini for the cloud agents.** Rejected: project is
  already wired to Anthropic, and the design system + voice rules read
  more naturally in Claude's output (anecdotal but consistent).
- **Skip ReasoningBank trajectory recording for V2.** Rejected: the
  recording is ~6 LOC per agent (call `trajectory-step`). Skipping it
  forfeits the post-V2 SONA path for trivial savings.
- **Use `agentdb_pattern-store` for trajectory storage instead of
  ReasoningBank.** Rejected: ReasoningBank IS backed by AgentDB; we'd
  be duplicating the wrapper. Use the higher-level API.

## References

- `docs/03_designs/dashboard-v2_spec.md` §"Real agents", §"Architecture
  options", §"Hackathon demo script"
- `docs/03_designs/dashboard-v2.html` lines 1232–1393 (mock swarm
  implementation that is the fallback path)
- `CLAUDE.md` — 3-Tier Model Routing table (ADR-026 row)
- `CLAUDE.md` — Memory & Vector Search section (the MCP tools we reuse)
- `CLAUDE.md` — Available Agents (already includes `code-review-swarm`,
  `swarm-coordinator`, `task-orchestrator` — same orchestration pattern)
- `docs/02_research/05_canonical_build_plan.md` §3 (data classification —
  the privacy invariant Agent 2/3 must honour)
- `docs/02_research/05_canonical_build_plan.md` §15 (post-V1 swarm
  scope — this ADR cashes that promise)
- ADR-007 (Supabase simplified — the cloud-link rules this ADR inherits)
- ADR-015 (4-state mapping — Agent 2's output is validated against)
- ADR-017 (signal expansion — Agent 2's State Mapper consumes the new
  signals when present)
- DDD-06 Reflection context — the implementation home of the swarm
- pi.ruv.io guidance: "3-tier routing", "ReasoningBank trajectories",
  "don't rebuild vector search / LoRA sync / embeddings"

## Test Hooks (London-school)

- `tests/reflection/agent1-on-device.spec.ts` — mocks
  `embeddings_generate`; feeds 8 canonical sentences (one per pattern
  category); asserts each returns the correct dominant pattern with
  score > 0.5; asserts no network call to any cloud endpoint.
- `tests/reflection/privacy.spec.ts` — mocks the Edge Function
  request; asserts the request body contains Agent 1's pattern output
  but NOT the raw user text; asserts Agent 3's request body contains
  the State Mapper's output but not the raw text.
- `tests/reflection/fallback.spec.ts` — uses fake timers; mocks the
  cloud call to never resolve; asserts the swarm completes within 4 s
  with `data-fallback="true"` on the final affirmation card.
- `tests/reflection/state-mapper-validation.spec.ts` — feeds an Agent 2
  output whose `dashboardState` disagrees with the sensor's; asserts the
  rendered dashboard uses the sensor's value AND the disagreement is
  recorded in the trajectory.
- `tests/reflection/aidefence.spec.ts` — feeds known prompt-injection
  attempts (e.g. "Ignore previous instructions and..."); asserts
  `aidefence_is_safe` returns false and the swarm refuses to run.
- E2E: `e2e/reflect-card.spec.ts` — types one of the sample prompts;
  waits for all 3 agents to reach 'done'; asserts the dashboard's
  state-dial colour changed; asserts a reframe text rendered.
