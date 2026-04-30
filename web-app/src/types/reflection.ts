/**
 * Reflection bounded context — public type surface.
 * Implements DDD-06 §Public Interface, ADR-016, ADR-018.
 *
 * Ownership: server-coder (Sprint B Block 1).
 * This is the canonical home for BreathProtocol (moved from display.ts per Sprint B TODO).
 * display.ts re-exports BreathProtocol from here for backward compatibility.
 */

import type { DashboardState } from './display';

// ---------------------------------------------------------------------------
// Re-export for consumers that import DashboardState from this module
// ---------------------------------------------------------------------------

export type { DashboardState };

// ---------------------------------------------------------------------------
// Pattern categories — exactly 8, closed union (ADR-016)
// ---------------------------------------------------------------------------

export type PatternKey =
  | 'urgency'
  | 'catastrophizing'
  | 'rumination'
  | 'exhaustion'
  | 'overwhelm'
  | 'minimization'
  | 'perfectionism'
  | 'isolation';

// ---------------------------------------------------------------------------
// Agent tier and status (DDD-06 §Ubiquitous Language)
// ---------------------------------------------------------------------------

export type AgentTier = 1 | 2 | 3;

export type AgentStatus = 'idle' | 'thinking' | 'done' | 'error';

// ---------------------------------------------------------------------------
// BreathProtocol — canonical definition (moved from display.ts — ADR-018)
// display.ts re-exports this type for backward compatibility.
// ---------------------------------------------------------------------------

export type BreathProtocol =
  | 'physiological_sigh'   // 5 rounds × (2s inhale + 1s top-up + 5s exhale)
  | 'box_breath'           // 4 rounds × (4s inhale + 4s hold + 4s exhale + 4s hold)
  | 'four_seven_eight';    // 4 rounds × (4s inhale + 7s hold + 8s exhale)

// ---------------------------------------------------------------------------
// Agent value objects (DDD-06 §Aggregates / Value Objects)
// ---------------------------------------------------------------------------

export interface PatternScore {
  /** One of the 8 canonical pattern categories. */
  key: PatternKey;
  /** Normalised score in [0, 1]. */
  score: number;
  /** Short phrase from the user's text used as evidence. */
  evidence: string;
}

export interface PatternScorerOutput {
  /** Top 3 patterns, score-descending. Invariant: every key is a PatternKey. */
  patterns: PatternScore[];
  /** One sentence of observations. Never echoed to cloud agents. */
  rawObservations: string;
}

export interface StateMapperOutput {
  /** Advisory DashboardState — sensor wins on disagreement (ADR-015). */
  state: DashboardState;
  /** Confidence in [0, 1]. */
  confidence: number;
  /** Evidence summary shown in the agent card. Max 80 chars. */
  evidenceTrace: string;
  /** Minutes until state escalation — only present for 'shifting' or 'overloaded'. */
  leadTimeMinutes?: number;
}

export interface ReframeWriterOutput {
  /** Observational reframe — 2 to 4 sentences, no exclamation points, no imperative. */
  reframe: string;
  /** Self-report on tone — tested against expected phrase set. */
  voiceCheck: string;
  /** Word count of the reframe text. */
  lengthWords: number;
  /** Agent 3's advisory breathing protocol selection (ADR-018). */
  protocol: BreathProtocol;
  /** 1-line rationale for the protocol choice. Max 80 chars. */
  protocolReason: string;
}

// ---------------------------------------------------------------------------
// ReflectRun — aggregate root (DDD-06)
// ---------------------------------------------------------------------------

export interface ReflectRun {
  /** UUID — used as transitionId in the Intervention row. */
  id: string;
  /** Unix timestamp (ms) of the run start. */
  ts: number;
  /** Agent 1 output (on-device, never sent to cloud). */
  patternScores: PatternScorerOutput;
  /** Agent 2 output (Haiku, state advisory). */
  stateMapping: StateMapperOutput;
  /** Agent 3 output (Sonnet, reframe + protocol). */
  reframe: ReframeWriterOutput;
  /** True if any agent fell back to deterministic mock. */
  fallbackUsed: boolean;
  /** Total wall-clock duration of the run in ms. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// ReflectStreamEvent — SSE discriminated union (ADR-016 §Streaming pattern)
// ---------------------------------------------------------------------------

export type ReflectStreamEvent =
  | { kind: 'agent-status'; agent: AgentTier; status: AgentStatus }
  | { kind: 'agent-payload'; agent: AgentTier; payload: unknown }
  | { kind: 'complete'; runId: string; durationMs: number }
  | { kind: 'error'; message: string };
