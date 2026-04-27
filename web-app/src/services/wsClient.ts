import type { SensingAPI, VitalsFrame, Unsubscribe } from '../types/vitals';

const DEFAULT_WS_URL = 'ws://localhost:8765/ws/sensing';
const DEFAULT_RECORDED_URL = '/fixtures/recorded-csi-session.jsonl';

interface WsClientOpts {
  /** WebSocket URL for live mode. */
  url?: string;
  /** JSONL fixture URL for `source: 'recorded'` mode. */
  recordedUrl?: string;
}

/**
 * Translate the daemon's `SensingUpdate` JSON into the internal `VitalsFrame`.
 *
 * Live frames from the sensing-server are NESTED:
 *   { vital_signs: { breathing_rate_bpm, heart_rate_bpm, signal_quality, ... },
 *     features:    { motion_band_power, breathing_band_power, ... },
 *     classification: { presence, motion_level, confidence },
 *     timestamp, source, tick, ... }
 *
 * Recorded fixtures (the V1 placeholder + verify-fixture.mjs) are FLAT:
 *   { ts, breathing_rate_bpm, heart_rate_bpm, presence, motion_band_power }
 *
 * This function accepts both shapes so the live and recorded paths share the
 * same downstream contract. (Verified against main.rs SensingUpdate.)
 */
function toFrame(raw: Record<string, unknown>, source: 'live' | 'recorded'): VitalsFrame {
  const v = (raw.vital_signs as Record<string, unknown> | undefined) ?? {};
  const f = (raw.features as Record<string, unknown> | undefined) ?? {};
  const c = (raw.classification as Record<string, unknown> | undefined) ?? {};

  // Daemon emits seconds (float) for `timestamp`; recorded fixtures emit ms in `ts`.
  const tsRaw = (raw.ts as number | undefined) ??
                (typeof raw.timestamp === 'number' ? raw.timestamp * 1000 : undefined);

  return {
    ts: tsRaw ?? Date.now(),
    breathBpm: (v.breathing_rate_bpm as number | undefined) ??
               (raw.breathing_rate_bpm as number | undefined),
    hrBpm: (v.heart_rate_bpm as number | undefined) ??
           (raw.heart_rate_bpm as number | undefined),
    presence: !!(c.presence ?? raw.presence),
    motionBandPower: (f.motion_band_power as number | undefined) ??
                     (raw.motion_band_power as number | undefined) ?? 0,
    source,
  };
}

export function createWsClient(opts?: WsClientOpts): SensingAPI {
  const url = opts?.url ?? (import.meta.env.DEV
    ? (import.meta.env.VITE_SENSING_WS_URL ?? DEFAULT_WS_URL)
    : DEFAULT_WS_URL);
  const recordedUrl = opts?.recordedUrl ?? DEFAULT_RECORDED_URL;

  const subscribers = new Set<(v: VitalsFrame) => void>();
  let socket: WebSocket | null = null;
  let recordedTimers: ReturnType<typeof setTimeout>[] = [];
  let recordedAborted = false;

  function emit(frame: VitalsFrame) {
    subscribers.forEach((cb) => cb(frame));
  }

  async function startRecorded() {
    recordedAborted = false;
    recordedTimers = [];
    let text: string;
    try {
      const res = await fetch(recordedUrl);
      if (!res.ok) return;
      text = await res.text();
    } catch {
      return;
    }
    if (recordedAborted) return;

    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    let firstTs: number | null = null;
    const playStart = Date.now();

    for (const line of lines) {
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(line);
      } catch {
        continue;
      }
      const ts = typeof raw.ts === 'number' ? raw.ts : Date.now();
      if (firstTs == null) firstTs = ts;
      const offsetMs = ts - firstTs;
      const t = setTimeout(() => {
        if (recordedAborted) return;
        // Re-stamp `ts` to wall clock so downstream classifiers see the
        // playback as live-paced (not stuck in the past).
        const frame = toFrame({ ...raw, ts: playStart + offsetMs }, 'recorded');
        emit(frame);
      }, offsetMs);
      recordedTimers.push(t);
    }
  }

  function start(o?: { source?: 'live' | 'recorded' }) {
    if (o?.source === 'recorded') {
      if (recordedTimers.length > 0) return;
      void startRecorded();
      return;
    }
    if (socket) return;
    socket = new WebSocket(url);
    socket.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        emit(toFrame(raw, 'live'));
      } catch {
        /* ignore malformed */
      }
    };
  }

  function stop() {
    socket?.close();
    socket = null;
    recordedAborted = true;
    for (const t of recordedTimers) clearTimeout(t);
    recordedTimers = [];
  }

  function subscribe(cb: (v: VitalsFrame) => void): Unsubscribe {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  return { subscribe, start, stop };
}
