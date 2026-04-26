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
