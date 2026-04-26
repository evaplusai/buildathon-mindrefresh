# ADR-008: Sensing-server upstream port and path locked

**Status:** Accepted
**Date:** 2026-04-26
**Build Day:** 3 of 8
**Supersedes:** (none)
**Superseded by:** (none)

## Context

Earlier project documents diverged on the sensing-server's port. An older
draft cited `8000`; the canonical build plan
(`docs/02_research/05_canonical_build_plan.md` §2) cites `8765`. Conflicting
port numbers across docs is the kind of paper-cut that wastes a demo-day
hour at the worst possible moment, so this ADR fixes the values against the
upstream Rust source and forbids drift without a superseding ADR.

The values we need to lock: the WebSocket port and path that the SPA's
`wsClient.ts` connects to, and the UDP port that the ESP32 firmware streams
CSI frames into. Both come from `upstream/RuView/v2/crates/wifi-densepose-sensing-server`.

## Decision

V1 client and firmware target exactly these endpoints. They are verified
against upstream code at the line numbers cited below; any change to those
upstream defaults requires this ADR be superseded before the client is
updated.

- **WebSocket URL:** `ws://localhost:8765/ws/sensing`
- **UDP CSI ingest port:** `5005`
- **Sensing-server bind address:** `127.0.0.1` (loopback only by default)

Verified in upstream code:

`upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/cli.rs` —

- Lines 13–16: `--ws-port` flag, `default_value = "8765"`.
- Lines 18–20: `--udp-port` flag, `default_value = "5005"`.
- Lines 30–32: `--bind-addr` flag, `default_value = "127.0.0.1"`,
  `env = "SENSING_BIND_ADDR"`.

`upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/main.rs` —

- Line 4662: `info!("  WebSocket: ws://localhost:{}/ws/sensing", args.ws_port);`
  — the startup banner the user sees on the terminal.
- Lines 4864–4869: the WebSocket router registration —
  `let ws_app = Router::new().route("/ws/sensing", get(ws_sensing_handler))`,
  bound at line 4871 to `SocketAddr::from((bind_ip, args.ws_port))` and
  served at lines 4876–4878.

The path is `/ws/sensing` (no version prefix, no trailing slash). The SPA
must not emit `/ws/sensing/` or `/v1/ws/sensing` or any other variant.

V1 does **not** parameterise the port via environment variable on the
client side. The constant lives in `src/services/wsClient.ts` as a
top-of-file `const SENSING_WS_URL = 'ws://localhost:8765/ws/sensing'`. The
recorded-fixture replay path (`?source=recorded`,
`docs/02_research/05_canonical_build_plan.md` §10 Day 5, item 4) does not
hit this URL at all — it reads JSONL through the same postMessage contract.

## Consequences

### Positive

- One source of truth for the port and path. A code-review check that
  greps for `8765` and `/ws/sensing` is sufficient to catch drift.
- The Day-3 risk gate
  (`docs/02_research/05_canonical_build_plan.md` §10 Day 3, item 2) verifies
  `cargo build -p wifi-densepose-sensing-server --no-default-features` from
  `upstream/RuView/v2`. Pass = the binary on the demo machine listens at
  exactly the locked endpoints.
- Loopback-only bind by default means a router-level firewall
  misconfiguration cannot expose the sensor stream to the LAN.

### Negative

- A user who already has another service on port 8765 will collide.
  Mitigation is to kill the other service or reflash the build with a
  changed sensing-server flag at launch time; the SPA cannot adapt without
  a code change. We accept this for V1 — the fix in V2 is a config screen
  in the SPA, not an env var (see Alternatives).
- The hardcoded URL means every developer running the SPA from the
  Vercel-deployed build hits `localhost:8765` regardless of network
  topology. There is no path for a user to point the SPA at a different
  machine on their LAN. Out of scope for V1.

### Neutral

- The 8080 HTTP port (`cli.rs` line 12, `--http-port`) is also used by the
  sensing-server for its own UI and REST surface, and the 5005 UDP port is
  a write-only ingest from the ESP32. The SPA touches neither.

## Alternatives Considered

- **Parameterise the WebSocket URL via `import.meta.env.VITE_SENSING_WS_URL`.**
  Rejected for V1: adds a configuration surface (`.env.local`, README
  setup steps, "did the user set the variable?" failure mode) without a
  V1 use case. Reintroduce when the SPA grows a config screen
  post-buildathon.
- **Use service discovery (mDNS / Bonjour) to find the sensing-server.**
  Rejected: browsers do not have first-class mDNS access; would require a
  helper. Far too much work for the V1 budget.
- **Use the upstream HTTP REST endpoints (`/api/v1/sensing/latest` at
  `cli.rs` default port 8080) instead of the WebSocket.** Rejected: REST
  polling at 1 Hz throws away the push semantics the sensing-server already
  provides, costs a JSON parse per tick instead of one connection setup,
  and breaks the latency budget for the `acute_spike` trigger.

## References

- `docs/02_research/05_canonical_build_plan.md` §2 (architecture diagram),
  §10 Day 3 item 2 (build verification gate), §10 Day 6 item 4
  (release-binary distribution), §12 ADR table (this ADR's row), §15
  references list.
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/cli.rs`
  lines 13–16 (`--ws-port` default `8765`), lines 18–20 (`--udp-port`
  default `5005`), lines 30–32 (`--bind-addr` default `127.0.0.1`).
- `upstream/RuView/v2/crates/wifi-densepose-sensing-server/src/main.rs`
  line 4662 (startup banner), lines 4864–4878 (WebSocket router
  registration and bind).
- ADR-005 (two-link architecture; this ADR fixes the local-link half).

## Test Hooks (London-school)

- `tests/sensing/wsClient.spec.ts`
  (`docs/02_research/05_canonical_build_plan.md` §13) constructs a mock
  `WebSocket` global and asserts the client connects to the literal URL
  `ws://localhost:8765/ws/sensing`. The test fails on any port or path
  drift.
