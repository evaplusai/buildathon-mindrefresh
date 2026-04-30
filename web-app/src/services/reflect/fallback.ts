/**
 * Deterministic fallback mocks for all 3 Reflect agents.
 * Ported from the design HTML reference (docs/03_designs/dashboard-v2.html lines 1237–1301).
 *
 * These are used when a real agent call exceeds the 4 s timeout budget,
 * or when ANTHROPIC_API_KEY is absent. The swarm always completes.
 *
 * Ownership: server-coder (Sprint B Block 1).
 */

import type {
  PatternScore,
  PatternScorerOutput,
  StateMapperOutput,
  ReframeWriterOutput,
  PatternKey,
  BreathProtocol,
} from '../../types/reflection';
import type { DashboardState } from '../../types/display';

// ---------------------------------------------------------------------------
// Pattern seed words — ported verbatim from design HTML lines 1237–1246
// ---------------------------------------------------------------------------

const PATTERNS: { key: PatternKey; words: string[] }[] = [
  { key: 'urgency',         words: ['behind', 'catch up', 'running out', 'no time', 'late', 'rushing', 'hurry', 'asap'] },
  { key: 'catastrophizing', words: ['everything', 'always', 'never', "can't", 'disaster', 'nightmare', 'ruined', 'failed'] },
  { key: 'rumination',      words: ['keep thinking', 'replaying', "can't stop", 'what if', 'should have', 'wish i', 'over and over'] },
  { key: 'exhaustion',      words: ['tired', 'exhausted', 'drained', 'spent', "can't even", 'no energy', 'wiped'] },
  { key: 'overwhelm',       words: ['so much', 'too much', 'head spinning', "can't handle", "don't know where", 'everything at once'] },
  { key: 'minimization',    words: ['just', 'fine', "it's fine", 'nothing', 'no big deal', 'whatever', "i'm okay"] },
  { key: 'perfectionism',   words: ['should have', 'better', 'wrong', 'mistake', 'not good enough', 'failed'] },
  { key: 'isolation',       words: ['alone', 'by myself', 'nobody', 'no one', 'just me'] },
];

// ---------------------------------------------------------------------------
// Reframe library — keyed by state, ported from design HTML lines 1277–1295
// ---------------------------------------------------------------------------

const REFRAMES: Record<DashboardState, string[]> = {
  overloaded: [
    "Your language suggests urgency and overload at the same time. Your system narrows focus when exhausted. Reducing the next step rather than accelerating is what the nervous system responds to.",
    "You're pointing at everything at once. The body responds to that the way it responds to a threat. Pick one thing you can complete in ten minutes.",
    "The words \"behind\" and \"catch up\" are doing more work than you are right now. There's no race. There's the next breath.",
  ],
  shifting: [
    "You're still in the window. The body is starting to ask for something — usually that's a slower exhale, not a faster pace.",
    "Your mind is replaying. That's rumination, not problem-solving. Notice the loop, then step out of it for sixty seconds.",
    "The phrase \"should have\" is showing up. That's the perfectionism reflex — it tightens the chest before it sharpens the mind.",
  ],
  drained: [
    "You're saying \"fine\" while the rest of your body is saying \"tired.\" The system needs activation now, not more rest. A two-minute walk is a stronger signal than another nap.",
    "The words are minimizing what your nervous system is doing. Drained doesn't resolve through pushing. It resolves through gentle re-engagement.",
  ],
  steady: [
    "Your language reads steady. There's no urgency, no looping. Whatever you're working with, you're working with it cleanly.",
  ],
};

// ---------------------------------------------------------------------------
// Protocol defaults per state (ADR-018 §A fallback table)
// ---------------------------------------------------------------------------

const PROTOCOL_BY_STATE: Record<DashboardState, BreathProtocol> = {
  shifting:   'physiological_sigh',
  overloaded: 'physiological_sigh',
  drained:    'box_breath',
  steady:     'physiological_sigh',
};

// ---------------------------------------------------------------------------
// Internal helpers — ported from design HTML
// ---------------------------------------------------------------------------

/** scoreText from design HTML lines 1248–1256 */
function scoreText(text: string): Record<PatternKey, number> {
  const lower = text.toLowerCase();
  const scores = {} as Record<PatternKey, number>;
  for (const { key, words } of PATTERNS) {
    const hits = words.filter(w => lower.includes(w)).length;
    scores[key] = Math.min(1, hits * 0.4);
  }
  return scores;
}

/** pickState from design HTML lines 1258–1266 */
function pickState(scores: Record<PatternKey, number>): DashboardState {
  if (scores.exhaustion > 0 && scores.minimization > 0) return 'drained';
  if (scores.urgency + scores.overwhelm + scores.catastrophizing >= 0.8) return 'overloaded';
  if (scores.rumination > 0 || scores.perfectionism > 0) return 'shifting';
  if (scores.urgency > 0 || scores.overwhelm > 0) return 'shifting';
  if ((Object.values(scores) as number[]).every(s => s === 0)) return 'steady';
  return 'shifting';
}

/** topPatterns — returns top 3 scoring patterns with score > 0 */
function topPatterns(scores: Record<PatternKey, number>): PatternScore[] {
  return (Object.entries(scores) as [PatternKey, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, score]) => ({
      key,
      score,
      evidence: PATTERNS.find(p => p.key === key)?.words[0] ?? key,
    }));
}

/** pickReframe from design HTML lines 1297–1301 */
function pickReframe(state: DashboardState): string {
  const pool = REFRAMES[state] ?? REFRAMES.steady;
  return pool[Math.floor(Math.random() * pool.length)];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Public mock functions
// ---------------------------------------------------------------------------

/**
 * Deterministic Pattern Scorer mock.
 * Uses seed-word frequency heuristics (design HTML `scoreText` / `topPatterns`).
 */
export function mockPatternScorer(text: string): PatternScorerOutput {
  const scores = scoreText(text);
  const patterns = topPatterns(scores);
  const dominant: PatternKey | undefined = patterns[0]?.key;
  return {
    patterns,
    rawObservations: `Language shows ${dominant ?? 'no strong'} patterns across ${text.split(/\s+/).length} words.`,
  };
}

/**
 * Deterministic State Mapper mock.
 * Applies pickState heuristics to the supplied pattern scores + sensor state.
 */
export function mockStateMapper(input: {
  patterns: PatternScore[];
  sensorState: DashboardState;
}): StateMapperOutput {
  // Reconstruct scores map from pattern array for pickState
  const scoresMap = Object.fromEntries(
    PATTERNS.map(p => [p.key, 0])
  ) as Record<PatternKey, number>;

  for (const { key, score } of input.patterns) {
    scoresMap[key] = score;
  }

  const state = pickState(scoresMap);
  const dominant = input.patterns[0];

  const result: StateMapperOutput = {
    state,
    confidence: dominant ? Math.min(0.8, 0.4 + dominant.score * 0.4) : 0.4,
    evidenceTrace: dominant
      ? `${dominant.key} pattern (score ${dominant.score.toFixed(2)}) drives state estimate`
      : 'No dominant pattern; defaulting to sensor context',
  };

  if (state === 'shifting' || state === 'overloaded') {
    result.leadTimeMinutes = state === 'overloaded' ? 0 : 5;
  }

  return result;
}

/**
 * Deterministic Reframe Writer mock.
 * Uses the REFRAMES pool from the design HTML reference.
 */
export function mockReframeWriter(input: {
  patterns: PatternScore[];
  state: DashboardState;
}): ReframeWriterOutput {
  const reframe = pickReframe(input.state);
  const protocol = PROTOCOL_BY_STATE[input.state];

  return {
    reframe,
    voiceCheck: 'observational, not corrective',
    lengthWords: countWords(reframe),
    protocol,
    protocolReason: 'Default protocol for the detected state.',
  };
}
