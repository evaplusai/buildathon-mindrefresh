#!/usr/bin/env bash
# sensor-up.sh — one-command bring-up for the Heltec V3 ESP32-S3 + sensing-server + dev SPA.
#
# Usage:
#   ./scripts/sensor-up.sh flash                        # just flash the firmware
#   ./scripts/sensor-up.sh provision SSID PASSWORD      # write WiFi creds + aggregator IP
#   ./scripts/sensor-up.sh up                           # start sensing-server + dev server
#   ./scripts/sensor-up.sh stream                       # tail the WS feed live
#   ./scripts/sensor-up.sh all SSID PASSWORD            # flash + provision + up + open browser
#   ./scripts/sensor-up.sh down                         # kill background processes
#
# Env overrides:
#   PORT      = serial port (default: auto-detect /dev/cu.usbserial-* or /dev/cu.SLAB_*)
#   LAN_IP    = laptop LAN IP (default: ipconfig getifaddr en0)
#   WS_PORT   = sensing-server WS port (default: 8765)
#   UDP_PORT  = sensing-server UDP ingest (default: 5005)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Auto-load .env at repo root if present (for SENSOR_SSID, SENSOR_PASSWORD, etc.)
if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi
FW_DIR="${REPO_ROOT}/upstream/RuView/firmware/esp32-csi-node"
BIN_DIR="${FW_DIR}/release_bins"
SERVER_DIR="${REPO_ROOT}/upstream/RuView/v2"
WEB_DIR="${REPO_ROOT}/web-app"
PID_DIR="${REPO_ROOT}/scripts/.run"
mkdir -p "$PID_DIR"

PORT="${PORT:-}"
if [[ -z "$PORT" ]]; then
  PORT="$(ls /dev/cu.usbserial-* 2>/dev/null | head -1 || true)"
  [[ -z "$PORT" ]] && PORT="$(ls /dev/cu.SLAB_* 2>/dev/null | head -1 || true)"
fi
LAN_IP="${LAN_IP:-}"
if [[ -z "$LAN_IP" ]]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
  [[ -z "$LAN_IP" ]] && LAN_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
WS_PORT="${WS_PORT:-8765}"
UDP_PORT="${UDP_PORT:-5005}"

die() { echo "ERROR: $*" >&2; exit 1; }
[[ -z "$PORT" ]] && die "no ESP32 serial port found. Plug in the Heltec via USB-C."
[[ -z "$LAN_IP" ]] && die "no LAN IP detected (en0/en1). Connect to WiFi."

cmd_flash() {
  echo ">> flashing $PORT (8 MB pre-built binaries)"
  python3 -m esptool --chip esp32s3 --port "$PORT" --baud 460800 \
    write_flash --flash_mode dio --flash_size 8MB \
    0x0     "${BIN_DIR}/bootloader.bin" \
    0x8000  "${BIN_DIR}/partition-table.bin" \
    0x10000 "${BIN_DIR}/esp32-csi-node.bin"
  echo ">> flash complete"
}

cmd_provision() {
  local ssid="${1:-${SENSOR_SSID:-}}"; local pw="${2:-${SENSOR_PASSWORD:-}}"
  [[ -z "$ssid" || -z "$pw" ]] && die "missing creds. Either pass: $0 provision SSID PASSWORD, or set SENSOR_SSID + SENSOR_PASSWORD in ${REPO_ROOT}/.env"
  echo ">> provisioning WiFi (ssid=$ssid, target=$LAN_IP)"
  python3 "${FW_DIR}/provision.py" --port "$PORT" \
    --ssid "$ssid" --password "$pw" --target-ip "$LAN_IP"
  echo ">> provisioned. ESP rebooting; CSI frames will hit ${LAN_IP}:${UDP_PORT} within ~30s."
}

cmd_up() {
  echo ">> starting sensing-server (binds 0.0.0.0:${UDP_PORT}, ws on ${WS_PORT})"
  ( cd "$SERVER_DIR" && \
    cargo run --release -p wifi-densepose-sensing-server --no-default-features -- \
      --bind-addr 0.0.0.0 --udp-port "$UDP_PORT" --ws-port "$WS_PORT" \
      > "${PID_DIR}/sensing-server.log" 2>&1 ) &
  echo $! > "${PID_DIR}/sensing-server.pid"

  echo ">> starting Vite dev server"
  ( cd "$WEB_DIR" && npm run dev > "${PID_DIR}/dev-server.log" 2>&1 ) &
  echo $! > "${PID_DIR}/dev-server.pid"

  # wait for ports
  for i in {1..30}; do
    if lsof -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1 && \
       lsof -iTCP:${WS_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  echo ">> dashboard ready: http://localhost:5173/dashboard"
  echo ">> stream watcher: $0 stream"
  echo ">> logs:           ${PID_DIR}/{sensing-server,dev-server}.log"
}

cmd_open() {
  open "http://localhost:5173/dashboard" 2>/dev/null || \
  echo ">> open http://localhost:5173/dashboard manually"
}

cmd_stream() {
  # Run from WEB_DIR so Node resolves the `ws` dep from web-app/node_modules.
  ( cd "$WEB_DIR" && node "${REPO_ROOT}/scripts/stream-watch.mjs" \
      "ws://localhost:${WS_PORT}/ws/sensing" )
}

cmd_down() {
  for f in sensing-server.pid dev-server.pid; do
    if [[ -f "${PID_DIR}/$f" ]]; then
      kill "$(cat "${PID_DIR}/$f")" 2>/dev/null || true
      rm -f "${PID_DIR}/$f"
    fi
  done
  echo ">> stopped"
}

cmd_all() {
  cmd_flash
  cmd_provision "${1:-${SENSOR_SSID:-}}" "${2:-${SENSOR_PASSWORD:-}}"
  cmd_up
  cmd_open
  echo ">> running. Watch the stream:  $0 stream"
  echo ">> stop:                       $0 down"
}

case "${1:-}" in
  flash)     cmd_flash ;;
  provision) cmd_provision "${2:-}" "${3:-}" ;;
  up)        cmd_up ;;
  open)      cmd_open ;;
  stream)    cmd_stream ;;
  down)      cmd_down ;;
  all)       cmd_all "${2:-}" "${3:-}" ;;
  *) echo "usage: $0 {flash|provision SSID PASS|up|open|stream|down|all SSID PASS}"; exit 1 ;;
esac
