MindRefreshStudio — Build Plan for Claude Code
Project summary
A nervous-system-aware web companion that detects stress trajectory and depletion via WiFi sensing, intervenes with affirmations and breathing exercises, and shows next-morning consequences of last-night choices. Built on ruvnet/RuView for sensor signal processing, with a custom trigger detection layer and a React experience layer.

The five components and how they connect
ESP32 sensor (in user's room)
    │
    │ UDP, raw CSI, port 5005
    ▼
RuView Rust binary (on user's laptop)
    │
    │ WebSocket, clean health signals, ws://localhost:8000
    ▼
Trigger server (on user's laptop) — YOUR IP
    │
    │ HTTPS POST when triggers fire
    ▼
Supabase cloud (free tier)
    │
    │ real-time WebSocket push + REST API
    ▼
React web app (deployed to Vercel) — YOUR IP
    │
    ▼
Judge's browser
Two layers come from RuView. Two layers are yours. Supabase is configured, not coded.

Component 1: Sensor firmware
What it is: RuView's ESP32 firmware that captures WiFi CSI and streams it over UDP to a target IP.
Where it lives: firmware/esp32-csi-node/ — vendored from RuView with MIT credit.
What needs configuring:
    • Your home WiFi SSID and password
    • Your laptop's IP address as the target
    • UDP port 5005
What's flashed onto the chip: A compiled binary built via Docker from the RuView source.
Connects to: RuView's Rust aggregator on your laptop, over your home WiFi using UDP.
What you don't do: Modify the C source. Touch promiscuous mode. Worry about CSI binary format.

Component 2: RuView signal processing
What it is: Cherry-picked Rust crates from RuView that turn raw CSI bytes into clean health signals. Run as a single compiled binary.
Where it lives: vendor/ruview/ — vendored from RuView with MIT credit. Five crates only: wifi-densepose-core, wifi-densepose-signal, wifi-densepose-hardware, wifi-densepose-vitals, wifi-densepose-api. The other crates (db, nn, mat, wasm, cli) are not included.
What it produces: A WebSocket on ws://localhost:8000 that publishes JSON like:
json
{
  "presence": true,
  "breathing_rate": 14.2,
  "heart_rate": 67,
  "hrv_sdnn": 52.4,
  "hrv_rmssd": 41.8,
  "motion": 0.03,
  "timestamp": "..."
}
Roughly 1 update per second.
Connects to: Sensor via UDP listener (port 5005), trigger server via WebSocket (port 8000).
Build path: cargo build --release --package wifi-densepose-api produces a single binary. Commit the binary or a build script.
What you don't do: Modify Rust code. Touch the FFT, Hampel filter, or PCA. Add new vital signs.

Component 3: Trigger server (YOUR IP)
What it is: A Node + TypeScript service that consumes RuView's WebSocket and detects 6 trigger events using rolling buffers, baseline learning, and time-of-day rules.
Where it lives: trigger-server/ — your code.
What it does:
    1. Connects to RuView's WebSocket as a client
    2. Maintains rolling buffers (last 60 SDNN readings, last 30 min of HR, cumulative load counter)
    3. Maintains per-user baselines (resting HRV, breath rate baseline) — uses RuView's example thresholds for cold start, transitions to personal baseline after 7 days
    4. Runs 6 detector functions every second
    5. When a trigger fires, posts an event to Supabase
The 6 trigger events:
    1. acute_spike — HRV drops sharply within 2 minutes
    2. slow_drift — HRV trending down for 10+ minutes
    3. cumulative_load — sustained high sympathetic for 3+ hours
    4. late_push — at desk after 10 PM with cumulative load
    5. recovery — HRV rising after a recent trigger
    6. morning_check — first presence detection of day, with overnight recovery score
HRV math (copied from RuView's stress example):
    • SDNN = standard deviation of R-R intervals
    • RMSSD = root mean square of successive differences
    • R-R interval (ms) = 60000 / heart_rate
    • Cold-start thresholds: <30 high stress, 30-50 moderate, 50-80 mild, 80-100 relaxed, >100 very relaxed
Trajectory math (your IP):
    • Slope of SDNN over rolling window via linear regression
    • Deviation from per-user baseline
    • Cumulative "elevated" minutes since 4 AM reset
    • Overnight recovery score = overnight average HRV / personal baseline
Time-of-day rules (your IP):
    • Same trajectory means different things at 11 AM vs 11 PM
    • After 10 PM with cumulative load → late_push not just slow_drift
    • First presence of the day → morning_check with overnight recovery report
Connects to: RuView WebSocket as input. Supabase REST API as output.
Persistence: Local SQLite for user baselines and event history (so the server survives restarts). Supabase mirrors this for the React app to read.

Component 4: Supabase cloud
What it is: Free-tier Postgres + auto-generated REST API + real-time WebSocket subscriptions. No code in your repo.
What needs configuring:
    • Project created via Supabase dashboard
    • Two tables created via SQL editor
    • Row Level Security disabled for v0
    • Anon key copied to environment variables
The two tables:
events
├── id (UUID)
├── user_id (UUID — hardcoded "demo-user-uuid" for v0)
├── trigger_type (text — one of the 6)
├── timestamp (timestamptz)
├── context (jsonb — flexible payload)
└── created_at (timestamptz)
user_baselines
├── user_id (UUID)
├── resting_hr (int)
├── baseline_sdnn (float)
├── baseline_breath_rate (float)
├── last_updated (timestamptz)
└── sample_count (int)
Auto-generated endpoints (no code):
    • POST /rest/v1/events — trigger server posts here
    • GET /rest/v1/events?user_id=... — React app reads history
    • wss://.../realtime/v1/... — React app subscribes to real-time pushes
Connects to: Trigger server (writes), React app (reads + subscribes).

Component 5: React web app (YOUR IP)
What it is: Vite + React + TypeScript + Tailwind + shadcn/ui app deployed to Vercel. Reads from Supabase, displays live state and triggers interventions.
Where it lives: web-app/ — your code, deployed to a public Vercel URL.
What it does:
    1. On load, fetches recent event history from Supabase
    2. Subscribes to Supabase real-time channel for new events
    3. When a new event arrives, picks the right intervention based on trigger type
    4. Renders the matching UI surface
    5. Computes morning report from yesterday's events
The affirmation library (your content):
    • ~50 hand-written sentences in src/affirmations.ts
    • 8 sentences per main trigger type, 4-6 for recovery, split into good/hard variants for morning_check
    • Time-of-day variants for triggers where it matters
    • Selection logic: filter by trigger type → exclude last 3 shown → random pick → render
The 6 UI surfaces:
Trigger	Surface	What user sees
acute_spike	Modal + breath circle	Centered modal, breath circle paced to live breath rate from sensor, 90-second cyclic sigh exercise
slow_drift	Corner toast	Bottom-right notification, fades after 8 seconds, no buttons
cumulative_load	Full-screen soft	Full screen calm, 5-min outside prompt, timer
late_push	Modal + 2 buttons	Tomorrow-cost framing, "Stopping" / "Pushing through" choice
recovery	Tiny ambient	Small text fade-in, 4-second display, no buttons
morning_check	First-screen card	Recovery report card on app open, capacity framing
The cyclic sighing widget (visual centerpiece):
    • Breath circle that grows on inhales, shrinks on exhales
    • Paces at target breath rate (5-6 BPM for cyclic sigh)
    • Live breath rate from sensor shown in corner
    • Demonstrates closed-loop sensing: sensor reads → app guides → sensor confirms slowing
The morning report card:
    • Shows last night's stop time
    • Shows sleep duration (computed from gap in events)
    • Shows overnight recovery score (HRV recovered as % of baseline)
    • Capacity framing: "today is a high-capacity day" or "today is decisions-only"
Connects to: Supabase for both reading history and subscribing to real-time events. No direct connection to trigger server.
Deployment: Vercel auto-deploys from main branch. Public URL is what judges see.

What you're explicitly NOT building
    • LoRA, fine-tuning, vector search, neural networks of any kind
    • Consumer WiFi setup app for sensor provisioning
    • Mobile app
    • User authentication, signups, login
    • Stripe subscriptions
    • Tauri desktop app
    • Cognitum Seed integration
    • Music, meditations, sleep stage classification
    • Pose estimation, multi-person tracking, fall detection
    • Custom domain (use Vercel's auto-generated URL)
    • Backups, monitoring, error tracking
These are v1+ post-buildathon features. Mention in pitch as roadmap.

Repo structure
mindrefresh-studio/
├── README.md
├── LICENSE (MIT)
├── docker-compose.yml          (optional, for "one command run")
├── start-all.sh                (orchestrates the three local services)
│
├── firmware/
│   └── esp32-csi-node/         (vendored from RuView, MIT credit)
│       ├── main/
│       ├── CMakeLists.txt
│       └── sdkconfig.defaults  (your WiFi credentials)
│
├── vendor/
│   └── ruview/                 (vendored, 5 crates, MIT credit)
│       ├── Cargo.toml
│       ├── wifi-densepose-core/
│       ├── wifi-densepose-signal/
│       ├── wifi-densepose-hardware/
│       ├── wifi-densepose-vitals/
│       └── wifi-densepose-api/
│
├── trigger-server/             (your IP)
│   ├── package.json
│   ├── src/
│   │   ├── ruview-client.ts    (consumes RuView WebSocket)
│   │   ├── baselines.ts        (cold-start + personal baseline learning)
│   │   ├── hrv-math.ts         (SDNN, RMSSD — translated from RuView Python example)
│   │   ├── triggers.ts         (6 detector functions)
│   │   ├── time-rules.ts       (depletion, late push, morning check)
│   │   ├── cloud-publisher.ts  (POSTs events to Supabase)
│   │   └── server.ts           (entry point)
│   └── data/
│       └── baselines.sqlite    (local persistence)
│
├── web-app/                    (your IP, deployed to Vercel)
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   └── supabase.ts     (client setup)
│   │   ├── triggers/
│   │   │   ├── selection.ts    (pick affirmation given trigger)
│   │   │   └── recency.ts      (avoid repetition)
│   │   ├── components/
│   │   │   ├── BreathCircle.tsx
│   │   │   ├── AcuteSpikeModal.tsx
│   │   │   ├── SlowDriftToast.tsx
│   │   │   ├── CumulativeLoadScreen.tsx
│   │   │   ├── LatePushModal.tsx
│   │   │   ├── RecoveryAmbient.tsx
│   │   │   └── MorningReport.tsx
│   │   └── data/
│   │       └── affirmations.ts (your hand-written library)
│   └── vite.config.ts
│
└── fixtures/
    └── recorded-session.jsonl  (demo fallback data)

Build order (dependency-driven, not day-driven)
Build in this order because each step depends on the previous:
    1. Repo + Supabase + Vercel skeleton — foundation to test connectivity
    2. RuView running with simulated data — gives you a fake stream to develop against
    3. Trigger server skeleton — connects to RuView, prints events to console
    4. Supabase integration — trigger server posts events, React app reads them
    5. HRV math + 6 trigger detectors — the brain of your trigger server
    6. Affirmation library + selection logic — the voice of your product
    7. 6 UI surfaces — what the user actually sees
    8. Breath circle widget — the visual centerpiece
    9. Morning report card — the consequence loop
    10. Real sensor flashing — replace simulated data with real CSI (can happen in parallel from step 5 onward)
    11. Demo fallback — record a clean session to JSONL for ?source=recorded query param
    12. Polish, demo video, write-up, submission
If steps 1-9 are done with simulated data, step 10 is a config swap. The sensor work is parallelizable with everything from step 5 onward, so don't block on hardware.

How judges will experience this
    1. Click your Vercel URL
    2. See your live React app
    3. Watch real-time triggers flowing in (real data from your sensor at your apartment, or recorded fallback if sensor is offline)
    4. See the 6 UI surfaces in action
    5. Optional: hit your Supabase REST API directly with curl
    6. Watch your demo video for the 24-hour arc story
Everything visible to judges is real. Your laptop is the always-on hub. Your sensor is the always-on data source. Supabase and Vercel are always-on infrastructure.

Pitch framing in one paragraph
"MindRefreshStudio catches the gap between body and mind. WiFi sensing detects autonomic shifts before you consciously notice stress. Trajectory math finds the slow drift before the cliff. Cumulative load tracking catches depletion hours before burnout. Privacy-by-design: raw biometric data stays in your room, only events reach our cloud. Built on ruvnet's open-source RuView sensing platform, with a custom trigger detection and intervention layer designed for women builders who routinely override their bodies until they crash. The body knows first. We help you listen."

Hand-off note for Claude Code
When working with Claude Code on this project, the highest-leverage instructions to give it are:
    • "Stand on RuView for sensing. Don't reinvent signal processing. Vendor only the 5 needed crates."
    • "Trigger detection is the IP. Spend the most care here. Trajectory and time-of-day rules are the differentiators, not absolute thresholds."
    • "Affirmations are content, not infrastructure. They live in the React app, not the trigger server. Hand-written, not generated."
    • "Real-time path is Supabase. No custom WebSocket server. No custom database."
    • "Demo must work end-to-end with real data. Recorded fallback is a backup, not the default."
That's the project. 