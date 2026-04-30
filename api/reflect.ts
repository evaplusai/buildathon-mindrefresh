/**
 * POST /api/reflect — Vercel Edge Function.
 * Runs State Mapper (Agent 2, Haiku) and Reframe Writer (Agent 3, Sonnet) in parallel.
 * Streams Server-Sent Events back to the SPA per ADR-016 §"Streaming pattern".
 *
 * Privacy invariants (ADR-016):
 * - Raw user text NEVER arrives at this endpoint — Agent 1 ran on-device.
 * - This endpoint receives ONLY Agent 1's structured output + sensor context.
 * - No request body fields are logged server-side.
 *
 * Ownership: server-coder (Sprint B Block 1).
 */

export const config = { runtime: 'edge' };

import Anthropic from '@anthropic-ai/sdk';
import { AGENT_SPECS } from '../web-app/src/services/reflect/agentSpecs';
import {
  validateStateMapperOutput,
  validateReframeWriterOutput,
} from '../web-app/src/services/reflect/validate';
import {
  mockStateMapper,
  mockReframeWriter,
} from '../web-app/src/services/reflect/fallback';
import type {
  PatternScore,
  StateMapperOutput,
  ReframeWriterOutput,
  ReflectStreamEvent,
} from '../web-app/src/types/reflection';
import type { DashboardState } from '../web-app/src/types/display';

// ---------------------------------------------------------------------------
// Request body shape (Agent 1 output, no raw user text)
// ---------------------------------------------------------------------------

interface ReflectRequestBody {
  patterns: PatternScore[];
  rawObservations: string;
  sensorState: DashboardState;
  breathBpm?: number;
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function sseChunk(event: ReflectStreamEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// ---------------------------------------------------------------------------
// Agent call wrappers with 4 s timeout + fallback
// ---------------------------------------------------------------------------

const AGENT_TIMEOUT_MS = 4000;

/** Race a promise against a fixed-ms timeout; resolve to null on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

async function callStateMapper(
  client: Anthropic,
  body: ReflectRequestBody,
): Promise<{ output: StateMapperOutput; fallback: boolean }> {
  const userContent = JSON.stringify({
    patterns: body.patterns,
    sensorState: body.sensorState,
    breathBpm: body.breathBpm ?? null,
  });

  try {
    const messagePromise = client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: AGENT_SPECS.stateMapper.systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const message = await withTimeout(messagePromise, AGENT_TIMEOUT_MS);

    if (message) {
      const rawText = message.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');

      const validated = validateStateMapperOutput(rawText);
      if (validated) {
        return { output: validated, fallback: false };
      }
    }
  } catch {
    // Fall through to mock — do NOT log error details (may contain request metadata)
  }

  return {
    output: mockStateMapper({ patterns: body.patterns, sensorState: body.sensorState }),
    fallback: true,
  };
}

async function callReframeWriter(
  client: Anthropic,
  body: ReflectRequestBody,
  stateMapperOutput: StateMapperOutput,
): Promise<{ output: ReframeWriterOutput; fallback: boolean }> {
  const userContent = JSON.stringify({
    patterns: body.patterns,
    state: stateMapperOutput.state,
  });

  try {
    const messagePromise = client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: AGENT_SPECS.reframeWriter.systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const message = await withTimeout(messagePromise, AGENT_TIMEOUT_MS);

    if (message) {
      const rawText = message.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');

      const validated = validateReframeWriterOutput(rawText);
      if (validated) {
        return { output: validated, fallback: false };
      }
    }
  } catch {
    // Fall through to mock
  }

  return {
    output: mockReframeWriter({ patterns: body.patterns, state: stateMapperOutput.state }),
    fallback: true,
  };
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

export default async function handler(request: Request): Promise<Response> {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Parse body — on any parse error, fall back to mocks gracefully
  let body: ReflectRequestBody;
  try {
    body = (await request.json()) as ReflectRequestBody;
  } catch {
    body = {
      patterns: [],
      rawObservations: '',
      sensorState: 'steady',
    };
  }

  // Validate sensorState membership — coerce unknown values to 'steady'
  const validStates: DashboardState[] = ['steady', 'shifting', 'overloaded', 'drained'];
  if (!validStates.includes(body.sensorState)) {
    body = { ...body, sensorState: 'steady' };
  }

  const runId = crypto.randomUUID();
  const startTs = Date.now();

  // Determine if we have an API key to call real models
  const apiKey = (typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined) ??
    // Edge runtime exposes env differently
    (globalThis as unknown as Record<string, string>)['ANTHROPIC_API_KEY'];

  const hasApiKey = typeof apiKey === 'string' && apiKey.trim().length > 0;

  const client = hasApiKey
    ? new Anthropic({ apiKey: apiKey as string })
    : null;

  // Build the SSE stream
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: ReflectStreamEvent) => {
        controller.enqueue(sseChunk(event));
      };

      try {
        // Agent 2 — State Mapper
        enqueue({ kind: 'agent-status', agent: 2, status: 'thinking' });

        let stateMapperResult: { output: StateMapperOutput; fallback: boolean };

        if (client) {
          stateMapperResult = await callStateMapper(client, body);
        } else {
          stateMapperResult = {
            output: mockStateMapper({ patterns: body.patterns, sensorState: body.sensorState }),
            fallback: true,
          };
        }

        enqueue({ kind: 'agent-payload', agent: 2, payload: stateMapperResult.output });
        enqueue({ kind: 'agent-status', agent: 2, status: 'done' });

        // Agent 3 — Reframe Writer (depends on Agent 2's state output)
        enqueue({ kind: 'agent-status', agent: 3, status: 'thinking' });

        let reframeResult: { output: ReframeWriterOutput; fallback: boolean };

        if (client) {
          reframeResult = await callReframeWriter(client, body, stateMapperResult.output);
        } else {
          reframeResult = {
            output: mockReframeWriter({ patterns: body.patterns, state: stateMapperResult.output.state }),
            fallback: true,
          };
        }

        enqueue({ kind: 'agent-payload', agent: 3, payload: reframeResult.output });
        enqueue({ kind: 'agent-status', agent: 3, status: 'done' });

        const durationMs = Date.now() - startTs;
        enqueue({ kind: 'complete', runId, durationMs });
      } catch {
        // Last-resort fallback — stream mocks so the demo never breaks
        const fallbackState = mockStateMapper({ patterns: body.patterns, sensorState: body.sensorState });
        const fallbackReframe = mockReframeWriter({ patterns: body.patterns, state: fallbackState.state });

        enqueue({ kind: 'agent-payload', agent: 2, payload: fallbackState });
        enqueue({ kind: 'agent-status', agent: 2, status: 'done' });
        enqueue({ kind: 'agent-payload', agent: 3, payload: fallbackReframe });
        enqueue({ kind: 'agent-status', agent: 3, status: 'done' });
        enqueue({ kind: 'complete', runId, durationMs: Date.now() - startTs });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
