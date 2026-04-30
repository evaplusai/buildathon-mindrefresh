/**
 * Agent 1 — Pattern Scorer (Tier 1, on-device)
 *
 * Implements ADR-016 §"Tier assignment per agent" for Agent 1.
 * All processing is on-device. Raw user text NEVER leaves this function.
 *
 * Two paths:
 *   Path A (Tier 1, primary):   MCP embeddings_generate → cosine similarity against
 *                                8 seed-phrase cluster centroids.
 *   Path B (Tier 1.5, fallback): Deterministic keyword regex from the design HTML
 *                                 scoreText() function (dashboard-v2.html lines 1248–1256).
 *
 * Privacy invariant: the only network calls permitted are to globalThis.mcp
 * (MCP bridge, localhost-only). If mcp is unavailable, Path B is used.
 * In V2, Path A is opt-in; Path B is the default until the MCP bridge ships
 * in the browser runtime.
 *
 * Ownership: client-coder (Sprint B Block 2).
 * DO NOT modify types/reflection.ts — owned by server-coder.
 */

import type { PatternKey, PatternScorerOutput } from '../../types/reflection';

// ---------------------------------------------------------------------------
// Seed-phrase clusters — one per PatternKey
// Source: docs/03_designs/dashboard-v2.html lines 1237–1245
// ---------------------------------------------------------------------------

interface SeedCluster {
  key: PatternKey;
  words: string[];
}

const SEED_CLUSTERS: SeedCluster[] = [
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
// Public interface
// ---------------------------------------------------------------------------

export interface PatternScorerOptions {
  text: string;
  /**
   * When true, skip MCP and use the deterministic regex path.
   * Tests use this flag. Also used automatically when globalThis.mcp is absent.
   */
  forceFallback?: boolean;
}

// ---------------------------------------------------------------------------
// Path B — deterministic keyword regex (scoreText port from design HTML)
// Latency target: < 200ms for 200-char input.
// ---------------------------------------------------------------------------

function scoreTextDeterministic(text: string): Record<PatternKey, number> {
  const t = text.toLowerCase();
  const scores = {} as Record<PatternKey, number>;
  for (const cluster of SEED_CLUSTERS) {
    const hits = cluster.words.filter(w => t.includes(w)).length;
    scores[cluster.key] = Math.min(1, hits * 0.4);
  }
  return scores;
}

/**
 * Build the evidence string for a cluster: return the first matched word/phrase,
 * or an empty string if nothing matched.
 */
function buildEvidence(text: string, cluster: SeedCluster): string {
  const t = text.toLowerCase();
  const hit = cluster.words.find(w => t.includes(w));
  return hit ?? '';
}

/**
 * Convert raw score map → PatternScorerOutput (top 3, score-desc).
 */
function toPatternScorerOutput(
  text: string,
  scores: Record<PatternKey, number>,
): PatternScorerOutput {
  const sorted = (Object.entries(scores) as [PatternKey, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const patterns = sorted.map(([key, score]) => {
    const cluster = SEED_CLUSTERS.find(c => c.key === key)!;
    return {
      key,
      score: Math.max(0, Math.min(1, score)),
      evidence: buildEvidence(text, cluster),
    };
  });

  // Build a one-sentence rawObservations summary (never echoed to cloud).
  const patternNames = patterns.map(p => p.key).join(', ');
  const rawObservations = patterns.length > 0
    ? `Detected linguistic patterns: ${patternNames}.`
    : 'No strong patterns detected.';

  return { patterns, rawObservations };
}

// ---------------------------------------------------------------------------
// Path A — MCP embeddings_generate → cosine similarity
// Latency target: < 500ms for 200-char input.
//
// In V2, Path A is opt-in and requires globalThis.mcp to be wired (MCP bridge).
// Default behaviour is Path B until the browser MCP bridge ships.
// ---------------------------------------------------------------------------

type MaybeVector = number[] | null;

/** Compute cosine similarity between two equal-length vectors. Returns 0 for zero-mag. */
function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Average a list of equal-length vectors into a centroid. */
function centroid(vecs: number[][]): number[] {
  if (vecs.length === 0) return [];
  const dim = vecs[0].length;
  const c = new Array<number>(dim).fill(0);
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) c[i] += v[i];
  }
  return c.map(x => x / vecs.length);
}

interface McpInterface {
  call(tool: string, params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Attempt to embed `text` and all cluster seed phrases via MCP, then
 * return cosine-similarity scores per cluster.
 * Returns null if MCP is unavailable or throws.
 */
async function scoreMCP(
  text: string,
  mcp: McpInterface,
): Promise<Record<PatternKey, number> | null> {
  try {
    // Embed the user text
    const textResult = await mcp.call('mcp__claude-flow__embeddings_generate', { text }) as { embedding?: number[] };
    const textVec: MaybeVector = textResult?.embedding ?? null;
    if (!textVec) return null;

    const scores = {} as Record<PatternKey, number>;

    for (const cluster of SEED_CLUSTERS) {
      const seedVecs: number[][] = [];
      for (const phrase of cluster.words) {
        const r = await mcp.call('mcp__claude-flow__embeddings_generate', { text: phrase }) as { embedding?: number[] };
        if (r?.embedding) seedVecs.push(r.embedding);
      }
      if (seedVecs.length === 0) {
        scores[cluster.key] = 0;
        continue;
      }
      const c = centroid(seedVecs);
      const sim = cosine(textVec, c);
      scores[cluster.key] = Math.max(0, sim); // clamp negative to 0
    }

    return scores;
  } catch {
    // MCP unavailable or error — fall through to Path B
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runPatternScorer(opts: PatternScorerOptions): Promise<PatternScorerOutput> {
  const { text, forceFallback = false } = opts;

  // Determine whether the MCP bridge is available in this runtime.
  // In browser without the bridge, globalThis.mcp is undefined.
  // In V2, Path A is opt-in; Path B is the default.
  const mcp = (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).mcp) as McpInterface | undefined;

  if (!forceFallback && mcp) {
    // Path A: MCP embeddings → cosine similarity
    const mcpScores = await scoreMCP(text, mcp);
    if (mcpScores !== null) {
      return toPatternScorerOutput(text, mcpScores);
    }
    // If MCP call failed, fall through to Path B
  }

  // Path B: deterministic keyword regex (default in V2 browser)
  const scores = scoreTextDeterministic(text);
  return toPatternScorerOutput(text, scores);
}
