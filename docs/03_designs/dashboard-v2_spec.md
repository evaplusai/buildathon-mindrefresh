# MindRefresh Dashboard — Claude Code Build Spec

This is the spec for the post-login Today page of MindRefresh, a contactless nervous-system awareness companion. The reference implementation (`dashboard-v2.html`) is a single self-contained HTML file with mocked agents. This doc tells Claude Code how to extend it with real capabilities.

---

## What's in the reference file

`dashboard-v2.html` is the canonical visual + interaction spec. It contains:

1. **Top nav** — logo, tabs (Today / Patterns / History / Sensor), Demo Mode toggle, user avatar
2. **Page header** — sensor-status pill, dynamic greeting, current time, day counter
3. **State Dial (hero card)** — current nervous-system state name, 4-state ladder (steady → shifting → overloaded → drained), animated SVG mandala that visually expresses the current state
4. **Live Signals panel** — dark green card showing breath rate, cardiac micro-motion, postural stillness, movement cadence with live-updating bars
5. **Reflect card (agentic interactive)** — the core demo feature. Text input + sample prompts. On submit, three agents run in parallel and update the dashboard.
6. **Reset card** — appears when state is shifting/overloaded/drained, with state-specific protocol text and "Begin reset" CTA
7. **Breathing modal** — full-screen overlay with animated orb that scales on inhale/hold/exhale, runs a 5-round physiological sigh
8. **Pattern Mirror** — 4 reflective observations from the user's last 12 days
9. **Today Strip** — horizontal timeline with colored segments showing state transitions, reset markers, and stats

The Demo Mode toggle in the top-right runs a scripted 44-second loop through all 4 states. Useful for unattended demos.

---

## Design system (must preserve)

These are non-negotiable for visual continuity with the marketing site:

| Token | Value |
|---|---|
| Primary green | `#27500A` (--green-800) |
| Deep green | `#173404` (--green-900) |
| Cream background | `#FBF9F2` (--cream) |
| Warm white surfaces | `#FFFEFA` (--warm-white) |
| Display font | Source Serif 4 (italics for emphasis) |
| Body font | Source Sans 3 |
| Mono labels | ui-monospace (uppercase, letter-spaced) |
| State color — steady | `#639922` |
| State color — shifting | `#C99B4F` (warm amber) |
| State color — overloaded | `#C97A6B` (rose) |
| State color — drained | `#6B7558` (muted gray-green) |

Border radius is 22px on cards, 14px on inner cards, 999px on pills. Text on green backgrounds uses cream / green-50 / green-100, never pure white. Italics in serif convey calm, observational tone — they're load-bearing, not decoration.

The voice is observational, not corrective. "Your system is shifting" not "You are stressed!" Reframes describe what the language is doing, not what the user should feel.

---

## The agent swarm — current vs. real

### Currently mocked (in the reference file)

The `runSwarm()` function in `dashboard-v2.html` simulates three agents using client-side pattern matching:

- **Agent 1 (Pattern Scorer)** — scans input for keywords across 8 categories (urgency, catastrophizing, rumination, exhaustion, overwhelm, minimization, perfectionism, isolation). Returns confidence scores 0–1.
- **Agent 2 (State Mapper)** — heuristic rules combine pattern scores into one of 4 nervous-system states, then renders the entire dashboard into that state.
- **Agent 3 (Reverse Affirmation Writer)** — picks from a hand-written reframe library keyed by state.

Output streams over ~2.8 seconds with staggered "thinking → done" transitions per agent. The full dashboard animates to the detected state when Agent 2 completes.

### What real agents should do

Replace the mocks with real model calls. The swarm should call three Claude (or local model) instances in parallel.

**Agent 1 — Linguistic Pattern Scorer**

System prompt should instruct Claude to read user text and return JSON like:

```json
{
  "patterns": [
    { "key": "urgency", "score": 0.8, "evidence": "behind on everything, can't catch up" },
    { "key": "catastrophizing", "score": 0.6, "evidence": "everything" },
    { "key": "exhaustion", "score": 0.3, "evidence": "tired" }
  ],
  "raw_observations": "Repeated use of absolute language. Time-pressure framing. Self-blame absent."
}
```

Categories must match the existing 8: urgency, catastrophizing, rumination, exhaustion, overwhelm, minimization, perfectionism, isolation. The UI renders these as colored chips (high ≥ 0.5 = rose, medium 0.2–0.5 = amber, low < 0.2 = subtle green).

**Agent 2 — State Mapper**

Receives Agent 1's output plus a simulated current sensor reading. Returns:

```json
{
  "state": "shifting",
  "confidence": 0.78,
  "evidence_trace": "Linguistic urgency + sensor breath rate climbing. 8-minute window open.",
  "lead_time_minutes": 8
}
```

State must be one of: `steady`, `shifting`, `overloaded`, `drained`. The frontend uses `state` to drive `renderState(state)` which updates the dial color, signal bars, ladder position, window pill, and reset card. `evidence_trace` displays beneath the state name in the agent card.

**Agent 3 — Reverse Affirmation Writer**

Receives both prior outputs. Returns a single reflective reframe in MindRefresh voice:

```json
{
  "reframe": "Your language suggests urgency and overload at the same time. Your system narrows focus when exhausted. Try reducing the next step instead of accelerating.",
  "voice_check": "observational, not corrective",
  "length_words": 26
}
```

Voice rules — **enforce in system prompt:**
- Observational, never corrective ("Your system narrows focus" not "You should slow down")
- Names what the language is doing, not what the user should feel
- Two to four short sentences max
- No exclamation points, no "!" emoji-equivalent enthusiasm
- Italics in the rendered output go on the key insight word — but model outputs plain text; frontend wraps `<em>` around the most observational verb phrase

---

## Architecture options for real agents

In order of demo reliability:

### Option 1 — Direct Claude API from the browser (simplest)

Use the in-browser `fetch` against `https://api.anthropic.com/v1/messages` with the user's API key in a server-issued temporary token. Three parallel `Promise.all` calls. Risk: any single network blip breaks the demo.

```javascript
async function runRealSwarm(text) {
  const [patterns, state, reframe] = await Promise.all([
    callAgent('pattern-scorer', text),
    callAgent('state-mapper', text),  // initially has no patterns yet
    callAgent('reframe-writer', text)
  ]);
  // Render results
}
```

**Production note:** this leaks API keys to the browser. Only acceptable for hackathon demo.

### Option 2 — Lightweight backend (recommended for production)

Stand up a single endpoint (Cloudflare Worker, Vercel Edge Function, FastAPI) that:

- Accepts `POST /reflect` with `{ text: string }`
- Fan-outs three Claude API calls in parallel server-side
- Streams progress back via Server-Sent Events: `{ agent: 1, status: "thinking" }` → `{ agent: 1, status: "done", payload: {...} }`
- Frontend handles SSE and updates each agent card as events arrive

This is the architecturally clean version. The visual UX in `dashboard-v2.html` already supports streaming reveal (the `setAgentStatus(n, 'thinking' | 'done')` calls), just swap the `setTimeout` triggers for SSE event handlers.

### Option 3 — Hybrid (what I'd actually ship for the hackathon)

Run real Claude calls but **fall back to mocks if anything fails or takes longer than 4 seconds**. The user sees a real demo when the network cooperates and a never-broken demo when it doesn't. Wrap the real call in a `Promise.race` against a timeout that resolves to mock output.

```javascript
const result = await Promise.race([
  callRealAgent(text),
  new Promise(resolve => setTimeout(() => resolve(mockResult(text)), 4000))
]);
```

---

## How to extend this for the full product

The reference is a single-file demo. For the actual app:

1. **Split into a real frontend** — extract the State Dial, Reflect Card, Reset Card, etc. into React components. The CSS variables are already structured for this.
2. **Connect to actual sensor data** — the `signals` object in `STATES` should come from a WebSocket subscription to the local sensor's API at `ws://sensor.local/stream`. Each state should be derived from real signal fusion, not preset.
3. **Persist Pattern Mirror observations** — these should come from a backend that runs longitudinal analysis on stored sessions. Currently the 4 observations are hardcoded.
4. **Today Strip from real timeline** — replace the hardcoded `segments` array with a query to the user's day, bucketed by state.
5. **Reset interactivity** — the breathing modal currently runs a single physiological sigh protocol. Add box breath, 4-7-8, and grounding prompts as separate protocols, picked by Agent 3.
6. **Privacy layer** — all model calls for the Pattern Scorer and State Mapper should happen on-device (small local model). Only the Reframe Writer needs cloud unless there's a privacy-grade local model available. This matches the PRD's "raw signals never leave the home" architecture.

---

## Hackathon demo script (60 seconds)

1. Open the dashboard. State is steady. Mention: "This is the Today view — twelve days into using MindRefresh. Right now the user's nervous system is steady — sensor's reading breath, cardiac micro-motion, postural stillness, movement cadence in real time."
2. Click one of the Reflect samples ("I'm so behind on everything"). Three agents fan out. Narrate: "Three agents in parallel — one scoring the language for nervous-system signals, one fusing language with sensor data into a state, one writing a reframe."
3. Watch the dashboard animate from steady to overloaded. The 8-minute pill slides in. Reset card appears. The reframe writes itself out below.
4. Click "Begin reset." Breathing orb fills the screen. Let one inhale-top-up-exhale cycle play.
5. Close the modal. "60 seconds. Back in the window. Day keeps going. No crash."

Total feature surface shown: state detection, signal fusion, agent swarm, reverse affirmation, personalized reset, breathing animation, Pattern Mirror, Today Strip — eight things, one minute.

---

## Files

- `dashboard-v2.html` — single-file reference implementation. Drop into any static host (Vercel, Netlify, plain S3) and it works. No build step.
- This document — hand this to Claude Code with the reference file. Claude Code can then either (a) extend in place, or (b) port to a real Next.js / React app using this as the visual + behavioral source of truth.
