import type { SensingAPI, VitalsFrame, Unsubscribe } from '../types/vitals';

const DEFAULT_WS_URL = 'ws://localhost:8765/ws/sensing';

export function createWsClient(opts?: { url?: string }): SensingAPI {
  const url = opts?.url ?? (import.meta.env.DEV
    ? (import.meta.env.VITE_SENSING_WS_URL ?? DEFAULT_WS_URL)
    : DEFAULT_WS_URL);

  const subscribers = new Set<(v: VitalsFrame) => void>();
  let socket: WebSocket | null = null;

  function start(o?: { source?: 'live' | 'recorded' }) {
    if (socket) return;
    if (o?.source === 'recorded') {
      // Sprint C will wire the JSONL replayer here. Skeleton: noop.
      return;
    }
    socket = new WebSocket(url);
    socket.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        const frame: VitalsFrame = {
          ts: raw.ts ?? Date.now(),
          breathBpm: raw.breathing_rate_bpm,
          hrBpm: raw.heart_rate_bpm,
          presence: !!raw.presence,
          motionBandPower: raw.motion_band_power ?? 0,
          source: 'live',
        };
        subscribers.forEach((cb) => cb(frame));
      } catch {
        /* ignore malformed */
      }
    };
  }

  function stop() {
    socket?.close();
    socket = null;
  }

  function subscribe(cb: (v: VitalsFrame) => void): Unsubscribe {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  return { subscribe, start, stop };
}
