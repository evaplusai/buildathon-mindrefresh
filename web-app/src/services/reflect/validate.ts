/**
 * Anti-corruption layer for agent JSON outputs.
 * Implements DDD-06 §"Anti-corruption layer" — coerces raw model responses
 * into typed value objects or returns null on failure so callers can substitute
 * the deterministic fallback without throwing.
 *
 * Ownership: server-coder (Sprint B Block 1).
 * No Zod / Yup — plain runtime checks only.
 */

import type {
  PatternScorerOutput,
  StateMapperOutput,
  ReframeWriterOutput,
  PatternKey,
  BreathProtocol,
} from '../../types/reflection';
import type { DashboardState } from '../../types/display';

// ---------------------------------------------------------------------------
// Closed enum sets used for membership checks
// ---------------------------------------------------------------------------

const PATTERN_KEYS = new Set<PatternKey>([
  'urgency', 'catastrophizing', 'rumination', 'exhaustion',
  'overwhelm', 'minimization', 'perfectionism', 'isolation',
]);

const DASHBOARD_STATES = new Set<DashboardState>([
  'steady', 'shifting', 'overloaded', 'drained',
]);

const BREATH_PROTOCOLS = new Set<BreathProtocol>([
  'physiological_sigh', 'box_breath', 'four_seven_eight',
]);

const VOICE_CHECK_PHRASES = new Set<string>([
  'observational, not corrective',
  'names what the language is doing',
  'two to four short sentences',
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strips markdown code fences from a string before JSON parsing.
 * Models sometimes wrap JSON in ```json\n...\n``` blocks.
 */
function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  return match ? match[1] : trimmed;
}

/**
 * Safely parse a value to JSON. Returns null on any error.
 * Accepts string (parsed) or already-parsed object/array.
 */
function safeParse(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(stripCodeFences(raw));
    } catch {
      return null;
    }
  }
  if (raw !== null && typeof raw === 'object') {
    return raw;
  }
  return null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && !Number.isNaN(v) && v >= min && v <= max;
}

// ---------------------------------------------------------------------------
// Public validators
// ---------------------------------------------------------------------------

/**
 * Validates and coerces raw model output into a PatternScorerOutput.
 * Returns null if the shape is invalid or any invariant is violated.
 */
export function validatePatternScorerOutput(raw: unknown): PatternScorerOutput | null {
  const parsed = safeParse(raw);
  if (!isObject(parsed)) return null;

  const { patterns, rawObservations } = parsed;

  if (!Array.isArray(patterns)) return null;
  if (typeof rawObservations !== 'string') return null;

  const validatedPatterns: PatternScorerOutput['patterns'] = [];

  for (const item of patterns) {
    if (!isObject(item)) return null;

    const { key, score, evidence } = item;

    if (typeof key !== 'string') return null;
    if (!PATTERN_KEYS.has(key as PatternKey)) return null;
    if (!isInRange(score, 0, 1)) return null;
    if (typeof evidence !== 'string') return null;

    validatedPatterns.push({
      key: key as PatternKey,
      score,
      evidence,
    });
  }

  // Enforce max 3 patterns (DDD-06: top 3, score-desc)
  if (validatedPatterns.length > 3) return null;

  return {
    patterns: validatedPatterns,
    rawObservations,
  };
}

/**
 * Validates and coerces raw model output into a StateMapperOutput.
 * Returns null if the shape is invalid or any invariant is violated.
 */
export function validateStateMapperOutput(raw: unknown): StateMapperOutput | null {
  const parsed = safeParse(raw);
  if (!isObject(parsed)) return null;

  const { state, confidence, evidenceTrace, leadTimeMinutes } = parsed;

  if (typeof state !== 'string') return null;
  if (!DASHBOARD_STATES.has(state as DashboardState)) return null;
  if (!isInRange(confidence, 0, 1)) return null;
  if (typeof evidenceTrace !== 'string') return null;
  if (evidenceTrace.length > 80) return null;

  const result: StateMapperOutput = {
    state: state as DashboardState,
    confidence,
    evidenceTrace,
  };

  // leadTimeMinutes is only valid when state is shifting or overloaded
  if (leadTimeMinutes !== undefined) {
    if (state === 'shifting' || state === 'overloaded') {
      if (typeof leadTimeMinutes === 'number' && !Number.isNaN(leadTimeMinutes) && leadTimeMinutes >= 0) {
        result.leadTimeMinutes = leadTimeMinutes;
      }
      // Invalid leadTimeMinutes → omit it rather than failing the entire output
    }
    // For steady/drained states, silently drop the field per the schema
  }

  return result;
}

/**
 * Validates and coerces raw model output into a ReframeWriterOutput.
 * Returns null if the shape is invalid or any invariant is violated.
 */
export function validateReframeWriterOutput(raw: unknown): ReframeWriterOutput | null {
  const parsed = safeParse(raw);
  if (!isObject(parsed)) return null;

  const { reframe, voiceCheck, lengthWords, protocol, protocolReason } = parsed;

  if (typeof reframe !== 'string' || reframe.length === 0) return null;
  if (typeof voiceCheck !== 'string') return null;
  if (!VOICE_CHECK_PHRASES.has(voiceCheck)) return null;
  if (typeof lengthWords !== 'number' || !Number.isInteger(lengthWords)) return null;
  // ADR-016/018: reframe is 2–4 sentences. Width allows short, dense
  // observational sentences (≥10 words) up to longer reframes (≤60).
  if (lengthWords < 10 || lengthWords > 60) return null;

  if (typeof protocol !== 'string') return null;
  if (!BREATH_PROTOCOLS.has(protocol as BreathProtocol)) return null;

  if (typeof protocolReason !== 'string') return null;
  if (protocolReason.length > 80) return null;

  // Voice rules: no exclamation points, no imperative ("you should") openers.
  if (reframe.includes('!')) return null;
  if (/\byou\s+should\b/i.test(reframe)) return null;

  return {
    reframe,
    voiceCheck,
    lengthWords,
    protocol: protocol as BreathProtocol,
    protocolReason,
  };
}
