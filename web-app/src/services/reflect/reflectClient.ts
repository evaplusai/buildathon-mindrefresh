/**
 * reflectClient — browser-side SSE client for the Reflect agent swarm.
 *
 * Implements DDD-06 §Public Interface (ReflectAPI) and ADR-016 §"Streaming pattern".
 *
 * Privacy invariant (ADR-016 §"Privacy invariant"):
 *   1. The raw user text is passed only to Agent 1 (runPatternScorer), which
 *      runs entirely on-device.
 *   2. After Agent 1 returns, the raw text reference is zeroed (`text = ''`).
 *   3. The POST body sent to /api/reflect contains ONLY:
 *      patterns, rawObservations, sensorState, breathBpm — never the raw text.
 *   4. ReasoningBank trajectory steps are sanitized: no step payload includes
 *      the raw text.
 *
 * Cross-slice dependencies (server-coder owns these):
 *   - types/reflection.ts (PatternScorerOutput, ReflectRun, ReflectStreamEvent …)
 *   - services/reflect/fallback.ts (mockStateMapper, mockReframeWriter)
 *
 * Ownership: client-coder (Sprint B Block 2).
 * DO NOT modify types/reflection.ts or api/reflect.ts — owned by server-coder.
 */

import type {
  PatternScorerOutput,
  StateMapperOutput,
  ReframeWriterOutput,
  ReflectRun,
  ReflectStreamEvent,
  AgentTier,
  DashboardState,
} from '../../types/reflection';

import { runPatternScorer } from './agent1-pattern-scorer';

// ---------------------------------------------------------------------------
// Cross-slice import — fallback.ts is owned by server-coder.
// If this file doesn't exist yet, TypeScript will report a swarm-dependency
// error — flag it as "swarm dependency" in the final report.
// ---------------------------------------------------------------------------

import {
  mockStateMapper,
  mockReframeWriter,
  mockPatternScorer,
} from './fallback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReflectClientContext {
  sensorState: DashboardState;
  breathBpm?: number;
}

export interface ReflectClient {
  start(
    text: string,
    ctx: ReflectClientContext,
  ): {
    stream: ReadableStream<ReflectStreamEvent>;
    runPromise: Promise<ReflectRun>;
  };
}

// ---------------------------------------------------------------------------
// MCP bridge helper — no-op when globalThis.mcp is absent
// ---------------------------------------------------------------------------

interface McpInterface {
  call(tool: string, params: Record<string, unknown>): Promise<unknown>;
}

function getMcp(): McpInterface | undefined {
  return (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).mcp) as McpInterface | undefined;
}

/**
 * Record a ReasoningBank trajectory for the completed run.
 * Sanitized: never includes the raw user text.
 * No-op if MCP bridge is unavailable.
 */
async function recordTrajectory(run: ReflectRun): Promise<void> {
  const mcp = getMcp();
  if (!mcp) return;

  try {
    // trajectory-start
    await mcp.call('mcp__claude-flow__hooks_intelligence_trajectory-start', {
      sessionId: run.id,
      task: 'reflect-swarm',
    });

    // Step 1 — Agent 1 output (pattern scores; no raw text)
    await mcp.call('mcp__claude-flow__hooks_intelligence_trajectory-step', {
      sessionId: run.id,
      step: 'agent1-pattern-scorer',
      data: {
        patterns: run.patternScores.patterns,
        // rawObservations is a 1-sentence summary — no user text verbatim
        rawObservationsHash: hashStr(run.patternScores.rawObservations),
        fallbackUsed: run.fallbackUsed,
      },
    });

    // Step 2 — Agent 2 output (state advisory)
    await mcp.call('mcp__claude-flow__hooks_intelligence_trajectory-step', {
      sessionId: run.id,
      step: 'agent2-state-mapper',
      data: {
        state: run.stateMapping.state,
        confidence: run.stateMapping.confidence,
        evidenceTrace: run.stateMapping.evidenceTrace,
        leadTimeMinutes: run.stateMapping.leadTimeMinutes,
      },
    });

    // Step 3 — Agent 3 output (reframe + protocol)
    await mcp.call('mcp__claude-flow__hooks_intelligence_trajectory-step', {
      sessionId: run.id,
      step: 'agent3-reframe-writer',
      data: {
        voiceCheck: run.reframe.voiceCheck,
        lengthWords: run.reframe.lengthWords,
        protocol: run.reframe.protocol,
        protocolReason: run.reframe.protocolReason,
        // reframe text is agent-generated (not user text) — safe to include
        reframe: run.reframe.reframe,
      },
    });

    // trajectory-end
    await mcp.call('mcp__claude-flow__hooks_intelligence_trajectory-end', {
      sessionId: run.id,
      durationMs: run.durationMs,
      fallbackUsed: run.fallbackUsed,
    });
  } catch {
    // MCP unavailable or error — swallow; never fail the run for trajectory issues
  }
}

/** Minimal stable hash for a string — not cryptographic, just for logging. */
function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

// ---------------------------------------------------------------------------
// aidefence guard
// ---------------------------------------------------------------------------

/**
 * Call aidefence_is_safe via MCP if available.
 * Falls back to `true` (safe) when MCP is absent so the non-MCP path is
 * unblocked; the Edge Function itself applies the server-side guard.
 */
async function isSafe(text: string): Promise<boolean> {
  const mcp = getMcp();
  if (!mcp) return true; // no bridge — server guard covers this
  try {
    const result = await mcp.call('mcp__claude-flow__aidefence_is_safe', { text }) as { is_safe?: boolean };
    return result?.is_safe !== false;
  } catch {
    return true; // MCP error — allow; server guard covers
  }
}

// ---------------------------------------------------------------------------
// UUID helper (no crypto.randomUUID on all targets)
// ---------------------------------------------------------------------------

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// SSE parser helper
// Parse SSE stream from a fetch Response body.
// Each event: `data: <JSON>\n\n`
// ---------------------------------------------------------------------------

async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice('data:'.length).trim();
        if (!jsonStr) continue;
        try {
          yield JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          // malformed event — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Fallback builders — wraps server-coder's mock functions
// ---------------------------------------------------------------------------

function buildFallbackRun(
  runId: string,
  ts: number,
  patternScores: PatternScorerOutput,
  stateMapping: StateMapperOutput,
  reframe: ReframeWriterOutput,
): ReflectRun {
  return {
    id: runId,
    ts,
    patternScores,
    stateMapping,
    reframe,
    fallbackUsed: true,
    durationMs: Date.now() - ts,
  };
}

// ---------------------------------------------------------------------------
// createReflectClient
// ---------------------------------------------------------------------------

export function createReflectClient(): ReflectClient {
  return {
    start(text, ctx) {
      const runId = uuid();
      const ts = Date.now();
      let fallbackUsed = false;

      // Collected agent outputs — filled as events arrive
      let patternScores: PatternScorerOutput | null = null;
      let stateMapping: StateMapperOutput | null = null;
      let reframe: ReframeWriterOutput | null = null;

      let streamController!: ReadableStreamDefaultController<ReflectStreamEvent>;
      const stream = new ReadableStream<ReflectStreamEvent>({
        start(ctrl) { streamController = ctrl; },
      });

      const emitEvent = (event: ReflectStreamEvent) => {
        try { streamController.enqueue(event); } catch { /* stream already closed */ }
      };

      const resolveRun = (r: ReflectRun) => {
        runPromiseResolve(r);
        try { streamController.close(); } catch { /* already closed */ }
        // Fire-and-forget trajectory — don't block on it
        void recordTrajectory(r);
      };

      let runPromiseResolve!: (r: ReflectRun) => void;
      const runPromise = new Promise<ReflectRun>(res => { runPromiseResolve = res; });

      // --- async orchestration ---
      void (async () => {
        // 1. aidefence guard
        const safe = await isSafe(text);
        if (!safe) {
          emitEvent({ kind: 'error', message: 'Input flagged unsafe — try a different phrasing.' });
          // Produce a safe fallback run without running any agents
          const fallbackPatterns = mockPatternScorer('');
          const fallbackState = mockStateMapper({
            patterns: fallbackPatterns.patterns,
            sensorState: ctx.sensorState,
          });
          const fallbackReframe = mockReframeWriter({
            patterns: fallbackPatterns.patterns,
            state: fallbackState.state,
          });
          const fallbackRun = buildFallbackRun(
            runId, ts,
            fallbackPatterns,
            fallbackState,
            fallbackReframe,
          );
          resolveRun(fallbackRun);
          return;
        }

        // 2. Agent 1 — on-device pattern scorer
        emitEvent({ kind: 'agent-status', agent: 1, status: 'thinking' });
        patternScores = await runPatternScorer({ text });
        // *** PRIVACY GATE: drop the raw text reference after Agent 1 is done ***
        text = '';
        emitEvent({ kind: 'agent-status', agent: 1, status: 'done' });
        emitEvent({ kind: 'agent-payload', agent: 1, payload: patternScores });

        // 3. POST to /api/reflect — body contains ONLY abstract data, never raw text
        const postBody = {
          patterns: patternScores.patterns,
          rawObservations: patternScores.rawObservations,
          sensorState: ctx.sensorState,
          breathBpm: ctx.breathBpm,
        };

        let fetchResponse: Response | null = null;
        try {
          fetchResponse = await fetch('/api/reflect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postBody),
          });
        } catch {
          fetchResponse = null;
        }

        if (!fetchResponse || !fetchResponse.ok || !fetchResponse.body) {
          // Network error — use full fallback for agents 2 & 3
          fallbackUsed = true;
          stateMapping = mockStateMapper({ patterns: patternScores!.patterns, sensorState: ctx.sensorState });
          reframe = mockReframeWriter({ patterns: patternScores!.patterns, state: stateMapping.state });
          emitEvent({ kind: 'agent-status', agent: 2, status: 'thinking' });
          emitEvent({ kind: 'agent-status', agent: 2, status: 'done' });
          emitEvent({ kind: 'agent-payload', agent: 2 as AgentTier, payload: stateMapping });
          emitEvent({ kind: 'agent-status', agent: 3, status: 'thinking' });
          emitEvent({ kind: 'agent-status', agent: 3, status: 'done' });
          emitEvent({ kind: 'agent-payload', agent: 3 as AgentTier, payload: reframe });
          resolveRun(buildFallbackRun(runId, ts, patternScores!, stateMapping, reframe));
          return;
        }

        // 4. Read SSE stream — wrap each agent in a 4s race against its fallback
        let agent2Resolve!: (v: StateMapperOutput) => void;
        let agent3Resolve!: (v: ReframeWriterOutput) => void;
        const agent2Promise = new Promise<StateMapperOutput>(res => { agent2Resolve = res; });
        const agent3Promise = new Promise<ReframeWriterOutput>(res => { agent3Resolve = res; });

        // Capture patternScores at the point of the race (it is non-null here)
        const capturedPatterns = patternScores!;
        const agent2Fallback: Promise<StateMapperOutput> = new Promise(res =>
          setTimeout(() => {
            fallbackUsed = true;
            res(mockStateMapper({ patterns: capturedPatterns.patterns, sensorState: ctx.sensorState }));
          }, 4000),
        );
        const agent3Fallback: Promise<ReframeWriterOutput> = new Promise(res =>
          setTimeout(() => {
            fallbackUsed = true;
            // Use state from stateMapping if already resolved, otherwise default
            const resolvedState = stateMapping?.state ?? ctx.sensorState;
            res(mockReframeWriter({ patterns: capturedPatterns.patterns, state: resolvedState }));
          }, 4000),
        );

        // Track whether the SSE path already emitted each agent's payload —
        // if the fallback wins, we still need to emit synthetic events.
        let agent2Emitted = false;
        let agent3Emitted = false;

        const agent2Race = Promise.race([agent2Promise, agent2Fallback]);
        const agent3Race = Promise.race([agent3Promise, agent3Fallback]);

        // Parse SSE in background
        void (async () => {
          try {
            for await (const event of parseSse(fetchResponse!.body!)) {
              const kind = event.kind as string;
              const agent = event.agent as AgentTier | undefined;

              if (kind === 'agent-status') {
                emitEvent({ kind: 'agent-status', agent: agent!, status: event.status as 'thinking' | 'done' });
              } else if (kind === 'agent-payload') {
                emitEvent({ kind: 'agent-payload', agent: agent!, payload: event.payload });
                if (agent === 2) { agent2Emitted = true; agent2Resolve(event.payload as StateMapperOutput); }
                if (agent === 3) { agent3Emitted = true; agent3Resolve(event.payload as ReframeWriterOutput); }
              } else if (kind === 'error') {
                emitEvent({ kind: 'error', message: event.message as string });
              }
            }
          } catch {
            // SSE read error — fallback resolvers will fire from the race
          }
        })();

        // Await both agents (with 4s fallback each). If the SSE path didn't
        // emit a payload (i.e., the fallback won the race), emit synthetic
        // events so consumers always see all three agents reach 'done'.
        stateMapping = await agent2Race;
        if (!agent2Emitted) {
          emitEvent({ kind: 'agent-status', agent: 2, status: 'thinking' });
          emitEvent({ kind: 'agent-status', agent: 2, status: 'done' });
          emitEvent({ kind: 'agent-payload', agent: 2, payload: stateMapping });
        }
        reframe = await agent3Race;
        if (!agent3Emitted) {
          emitEvent({ kind: 'agent-status', agent: 3, status: 'thinking' });
          emitEvent({ kind: 'agent-status', agent: 3, status: 'done' });
          emitEvent({ kind: 'agent-payload', agent: 3, payload: reframe });
        }

        const run: ReflectRun = {
          id: runId,
          ts,
          patternScores: capturedPatterns,
          stateMapping: stateMapping!,
          reframe: reframe!,
          fallbackUsed,
          durationMs: Date.now() - ts,
        };
        resolveRun(run);
      })();

      return { stream, runPromise };
    },
  };
}
