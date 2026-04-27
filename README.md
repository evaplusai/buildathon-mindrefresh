# MindRefreshStudio

A contactless somatic-regulation companion built on RuView WiFi-CSI sensing.

> Live URL: <https://mindrefresh-studio.vercel.app/> (Vercel deploy pending)

MindRefreshStudio reads your breath rate from a $9 ESP32-S3 WiFi sensor — no
camera, no watch, no skin contact — classifies your nervous-system state
(regulated / activated / recovering), and meets each transition with a
state-matched somatic affirmation. The morning check compares today's first
baseline to yesterday's state events and surfaces what last night did to
today.

---

## Quick start

### Live mode (requires macOS arm64 + sensor)

```bash
# 1. Run the local sensing daemon
cd upstream/RuView/v2
cargo run -p wifi-densepose-sensing-server --no-default-features

# 2. In another terminal, run the SPA
cd web-app
npm install
npm run dev

# 3. Open http://localhost:5173/dashboard
```

You will need a Heltec V3 ESP32-S3 flashed with the RuView CSI firmware. See
`upstream/RuView/firmware/esp32-csi-node/README.md` for flashing instructions
(Docker `espressif/idf:v5.2`).

### Recorded mode (any platform, no hardware)

```bash
cd web-app
npm install
npm run dev
# Open http://localhost:5173/dashboard?source=recorded
```

This replays a captured CSI fixture through the same WebSocket contract.
Judges who don't have the sensor can still see the full demo arc.

### Optional — enable cloud sync

Copy `web-app/.env.example` to `web-app/.env.local` and fill in your Supabase
project credentials. Run the migration in `web-app/supabase/migrations/`
through your Supabase SQL editor. Without these the app runs local-only and
the morning check still works against IndexedDB.

---

## Limitations

- **Live mode requires macOS arm64 with the released sensing-server binary;
  all other platforms use `?source=recorded`.** A pre-built binary is
  attached to the GitHub Release `v0.1.0-mindrefresh`.
- **V1 ships with a hardcoded `user_id = 'demo-user-001'`** (per ADR-007).
  Magic-link auth + RLS is post-buildathon (ADR-011 deferred). All judges
  share the same fictional user's history — which is exactly what the
  morning_check demo needs.
- **Supabase free-tier auto-pauses after 7 days of inactivity.** Re-wake by
  opening the project dashboard once.

---

## Architecture

```
+------------------------------------------------------------+
| Layer 1 — ESP32-S3 + RuView esp32-csi-node firmware        |
|   UDP CSI frames, port 5005, ~20 Hz                         |
+------------------------------------------------------------+
| Layer 2 — wifi-densepose-sensing-server (Rust, 127.0.0.1)  |
|   FFT vital-sign extraction; emits VitalsFrame over WS      |
|   ws://localhost:8765/ws/sensing  (1 Hz)                    |
+------------------------------------------------------------+
| Layer 3 — React SPA (browser, served by Vercel)             |
|   WebSocket client → Web Worker (3-state classifier +       |
|     5 trigger detectors incl. morning_check) → UI cards     |
|   IndexedDB session store (source of truth)                 |
+------------------------------------------------------------+
| Layer 4 — Supabase (managed cloud, V1 = 2 tables)           |
|   state_transitions + interventions; anon writes;           |
|   labels and affirmation IDs only — no raw vitals.          |
+------------------------------------------------------------+
```

Full system architecture lives in
[`docs/05_architecture/01_system_architecture.md`](docs/05_architecture/01_system_architecture.md).
ADRs 005–011 cover the load-bearing decisions in
[`docs/adr/`](docs/adr/).

---

## Privacy promise

> Raw biometric signals never leave your device. Only state events sync, to
> enable the morning check across devices.

Privacy is structural, not toggle-driven. The Memory bounded context
(`docs/ddd/04_memory_context.md`) guarantees by construction that:

1. Per-second vitals stay in the browser ring buffer.
2. The user-typed "what's alive" sentence stays in IndexedDB.
3. Only state transitions and affirmation IDs ever cross the cloud link.

A judge with DevTools open can verify both: the WebSocket frame to
`localhost:8765` carries post-FFT vitals, and the only HTTPS POSTs leaving
the browser go to `*.supabase.co` carrying state labels and affirmation IDs.

---

## RuView attribution

This project depends on
[`ruvnet/RuView`](https://github.com/ruvnet/RuView) for the ESP32 CSI
firmware (`upstream/RuView/firmware/esp32-csi-node`) and the pure-Rust
`wifi-densepose-sensing-server` crate that performs FFT vital-sign
extraction. Both are vendored under `upstream/RuView/`. RuView is MIT
licensed, compatible with this repository's MIT license. Without RuView
this project would not exist; thank you to the RuView contributors for the
contactless sensing foundation.

---

## V1 cuts (post-buildathon roadmap)

The following are deliberately out of V1. Each remains on the roadmap and
the corresponding ADRs document the rationale.

- HRV from RR intervals (60-GHz radar pairing) — ADR-006
- 4-state polyvagal classifier (the `shutdown` state) — ADR-010
- 8-dimensional wellness vector
- HNSW retrieval over affirmations (`@ruvector/core`)
- WebGPU LLM rephrasing (`@ruvector/ruvllm`)
- SONA per-user MicroLoRA personalisation (`@ruvector/sona`)
- Magic-link auth + Supabase RLS — ADR-011 (deferred)
- WhatsAlive embedding pipeline

---

## Acknowledgements

- Peter Levine — *Waking the Tiger*
- Deb Dana — *Polyvagal Theory in Therapy*
- Stephen Porges — polyvagal theory foundational papers
- Yilmaz Balban et al., 2023 — Stanford cyclic-sigh paper
  ([Cell Reports Medicine](https://www.cell.com/cell-reports-medicine/pdf/S2666-3791(22)00474-8.pdf))
- The RuView contributors — contactless sensing infrastructure

---

## License

MIT — see [`LICENSE`](LICENSE).

---

## Submission

- Live URL: <https://mindrefresh-studio.vercel.app/>
- Demo video (Loom): _pending Day 7_
- Demo video (YouTube unlisted backup): _pending Day 7_
- Public GitHub repository: this repo
- Sensor wiring photo: see `docs/assets/sensor-wiring.jpg` once captured (Day 6 task)
- Dev tools: `?source=recorded` replays a fixture; `?dev=1` exposes a "Force morning check" button on the dashboard
