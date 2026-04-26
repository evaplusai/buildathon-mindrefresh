import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { createWsClient } from '../../src/services/wsClient';
import type { VitalsFrame } from '../../src/types/vitals';

const URL = 'ws://localhost:8765/ws/sensing';

describe('wsClient (ADR-008 port and path locked)', () => {
  let server: Server;
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    // mock-socket installs a fake WebSocket compatible with the global type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = MockWebSocket;
    server = new Server(URL);
  });

  afterEach(() => {
    server.stop();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = originalWebSocket;
  });

  it('connects to the locked URL and parses a SensingUpdate frame to VitalsFrame', async () => {
    const client = createWsClient({ url: URL });
    const received: VitalsFrame[] = [];
    client.subscribe((v) => received.push(v));

    const connected = new Promise<void>((resolve) => {
      server.on('connection', (socket) => {
        // Push a canned SensingUpdate JSON frame, snake_case as the daemon emits it.
        socket.send(
          JSON.stringify({
            ts: 1_700_000_000_000,
            breathing_rate_bpm: 12.5,
            heart_rate_bpm: 68,
            presence: true,
            motion_band_power: 0.42,
          }),
        );
        resolve();
      });
    });

    client.start();
    await connected;
    // Wait for the message to round-trip.
    await vi.waitFor(() => expect(received.length).toBeGreaterThan(0));

    const v = received[0];
    expect(v.ts).toBe(1_700_000_000_000);
    expect(v.breathBpm).toBe(12.5);
    expect(v.hrBpm).toBe(68);
    expect(v.presence).toBe(true);
    expect(v.motionBandPower).toBeCloseTo(0.42, 5);
    expect(v.source).toBe('live');

    client.stop();
  });

  it('source=recorded fetches the JSONL fixture and emits parsed frames at their ts offsets', async () => {
    const startTs = 1_700_000_000_000;
    // Three frames at 0 s, 1 s, 2 s offsets — small enough for the test to wait through.
    const lines = [
      JSON.stringify({ ts: startTs, breathing_rate_bpm: 12, presence: true, motion_band_power: 0.2 }),
      JSON.stringify({ ts: startTs + 1000, breathing_rate_bpm: 14, presence: true, motion_band_power: 0.3 }),
      JSON.stringify({ ts: startTs + 2000, breathing_rate_bpm: 16, presence: true, motion_band_power: 0.4 }),
    ].join('\n');

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(lines, { status: 200 }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchSpy;

    const client = createWsClient({ recordedUrl: '/fixtures/test.jsonl' });
    const received: VitalsFrame[] = [];
    client.subscribe((v) => received.push(v));
    client.start({ source: 'recorded' });

    // The first frame is scheduled at offset 0 — should arrive after a microtask + 0ms timeout.
    await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(1), { timeout: 1000 });
    expect(received[0].breathBpm).toBe(12);
    expect(received[0].source).toBe('recorded');
    expect(received[0].presence).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith('/fixtures/test.jsonl');

    // Wait for the third frame (~2s offset).
    await vi.waitFor(() => expect(received.length).toBe(3), { timeout: 4000 });
    expect(received.map((f) => f.breathBpm)).toEqual([12, 14, 16]);

    client.stop();
  });

  it('source=recorded stop() cancels in-flight scheduled frames', async () => {
    const startTs = 1_700_000_000_000;
    const lines = [
      JSON.stringify({ ts: startTs, breathing_rate_bpm: 12, presence: true, motion_band_power: 0 }),
      JSON.stringify({ ts: startTs + 5000, breathing_rate_bpm: 14, presence: true, motion_band_power: 0 }),
    ].join('\n');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response(lines, { status: 200 }));

    const client = createWsClient({ recordedUrl: '/fixtures/test.jsonl' });
    const received: VitalsFrame[] = [];
    client.subscribe((v) => received.push(v));
    client.start({ source: 'recorded' });

    await vi.waitFor(() => expect(received.length).toBe(1), { timeout: 1000 });
    client.stop();
    // Wait past the would-be second frame; it must NOT arrive.
    await new Promise((r) => setTimeout(r, 200));
    expect(received.length).toBe(1);
  });

  it('subscribe returns an unsubscribe function that detaches the listener', async () => {
    const client = createWsClient({ url: URL });
    const cb = vi.fn();
    const unsubscribe = client.subscribe(cb);
    unsubscribe();

    const connected = new Promise<void>((resolve) => {
      server.on('connection', (socket) => {
        socket.send(
          JSON.stringify({
            ts: 1,
            breathing_rate_bpm: 10,
            presence: false,
            motion_band_power: 0,
          }),
        );
        resolve();
      });
    });

    client.start();
    await connected;
    // Give the message loop a beat.
    await new Promise((r) => setTimeout(r, 20));
    expect(cb).not.toHaveBeenCalled();

    client.stop();
  });
});
