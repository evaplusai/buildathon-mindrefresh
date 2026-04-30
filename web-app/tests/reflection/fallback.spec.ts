/**
 * Fallback tests — ADR-016 §"Hybrid fallback".
 *
 * Uses fake timers. Mocks fetch to return a never-resolving stream.
 * Advances time by 5s and asserts:
 *   - runPromise resolves within 5s of fake-timer advance
 *   - Result has fallbackUsed: true
 *   - All 3 agents have a payload (Agent 1 from on-device; Agents 2+3 from mock fallback)
 *
 * Ownership: client-coder (Sprint B Block 2, task DB-B2-T5).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReflectClient } from '../../src/services/reflect/reflectClient';
import type { DashboardState, ReflectStreamEvent } from '../../src/types/reflection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectEvents(
  stream: ReadableStream<ReflectStreamEvent>,
): Promise<ReflectStreamEvent[]> {
  const events: ReflectStreamEvent[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    events.push(value);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reflectClient — hybrid fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('mcp', undefined); // no MCP bridge

    // fetch returns a stream that never emits data — simulates network timeout
    const neverEndingStream = new ReadableStream<Uint8Array>({
      start() {
        // never calls controller.close() or enqueue
      },
    });

    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        new Response(neverEndingStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    ));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves within 5s (fake timers) with fallbackUsed: true', async () => {
    const client = createReflectClient();
    const { stream, runPromise } = client.start('I am so tired', {
      sensorState: 'drained' as DashboardState,
    });

    // Collect stream events concurrently
    const eventsPromise = collectEvents(stream);

    // Advance fake timers by 5 seconds — triggers the 4s fallback races
    await vi.advanceTimersByTimeAsync(5000);

    const [run, events] = await Promise.all([runPromise, eventsPromise]);

    expect(run.fallbackUsed).toBe(true);
    expect(run.durationMs).toBeGreaterThan(0);

    // Agent 1 must have a payload (on-device, no timeout dependency)
    const agent1Payload = events.find(
      e => e.kind === 'agent-payload' && (e as { kind: string; agent: number }).agent === 1,
    );
    expect(agent1Payload).toBeDefined();

    // Agents 2 and 3 must have payloads (from mock fallback after 4s race)
    const agent2Payload = events.find(
      e => e.kind === 'agent-payload' && (e as { kind: string; agent: number }).agent === 2,
    );
    const agent3Payload = events.find(
      e => e.kind === 'agent-payload' && (e as { kind: string; agent: number }).agent === 3,
    );
    expect(agent2Payload).toBeDefined();
    expect(agent3Payload).toBeDefined();
  });

  it('run result has valid patternScores from on-device Agent 1', async () => {
    const client = createReflectClient();
    const { stream, runPromise } = client.start('I am so exhausted and drained', {
      sensorState: 'drained' as DashboardState,
    });

    const eventsPromise = collectEvents(stream);
    await vi.advanceTimersByTimeAsync(5000);
    const [run] = await Promise.all([runPromise, eventsPromise]);

    // Agent 1 runs on-device; its output should not be a fallback (only Agents 2+3 fallback)
    expect(run.patternScores).toBeDefined();
    expect(Array.isArray(run.patternScores.patterns)).toBe(true);
    expect(run.patternScores.rawObservations).toBeTypeOf('string');
  });

  it('run result has stateMapping and reframe from mock fallback', async () => {
    const client = createReflectClient();
    const { stream, runPromise } = client.start('I feel overwhelmed', {
      sensorState: 'overloaded' as DashboardState,
    });

    const eventsPromise = collectEvents(stream);
    await vi.advanceTimersByTimeAsync(5000);
    const [run] = await Promise.all([runPromise, eventsPromise]);

    expect(run.stateMapping).toBeDefined();
    expect(run.stateMapping.state).toBeTypeOf('string');

    expect(run.reframe).toBeDefined();
    expect(run.reframe.reframe).toBeTypeOf('string');
  });
});
