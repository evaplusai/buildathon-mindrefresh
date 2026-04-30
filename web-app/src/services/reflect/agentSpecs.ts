/**
 * Agent specifications — system prompts and JSON schemas for the 3 Reflect agents.
 * Implements DDD-06 §AgentSpec aggregate, ADR-016 §Tier assignment.
 *
 * Ownership: server-coder (Sprint B Block 1).
 * Privacy invariant (ADR-016): raw user text NEVER appears in Agent 2 or 3 prompts.
 */

/**
 * JSON-schema shapes embedded in each agent spec.
 * These are sent as part of the system prompt to guide structured output.
 */
export interface AgentSchema {
  type: 'object';
  required: string[];
  properties: Record<string, unknown>;
}

export interface AgentSpec<T extends 1 | 2 | 3> {
  readonly tier: T;
  readonly systemPrompt: string;
  readonly schema: AgentSchema;
}

// ---------------------------------------------------------------------------
// Agent 1 — Pattern Scorer (Tier 1 — on-device WASM / deterministic fallback)
// Receives: raw user text (only this agent does — ADR-016 §Privacy invariant)
// Outputs: PatternScorerOutput
// ---------------------------------------------------------------------------

const patternScorerPrompt = `\
You are a linguistic pattern classifier. Your task is to read a user's text and identify \
emotional and cognitive patterns from a fixed vocabulary of 8 categories.

Categories (exhaustive — use only these keys):
  urgency, catastrophizing, rumination, exhaustion, overwhelm, minimization, perfectionism, isolation

For each pattern detected, assign a score between 0 and 1 (inclusive) that reflects how strongly \
it is expressed in the text. A score of 0 means the pattern is absent. A score of 1 means the \
pattern is fully dominant in the language. Provide up to 3 patterns with score > 0, ranked by score \
(highest first). For each, include a short evidence phrase (3–8 words) lifted verbatim from the input.

Also write a single sentence of raw observations summarising the overall linguistic tone. \
This observation is for local use only and will not be forwarded to any other agent.

Respond with ONLY valid JSON. Do not wrap in markdown code fences. Match this schema exactly:
{
  "patterns": [
    { "key": "<PatternKey>", "score": <number 0..1>, "evidence": "<short phrase from input>" }
  ],
  "rawObservations": "<one sentence>"
}`;

const patternScorerSchema: AgentSchema = {
  type: 'object',
  required: ['patterns', 'rawObservations'],
  properties: {
    patterns: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        required: ['key', 'score', 'evidence'],
        properties: {
          key: {
            type: 'string',
            enum: [
              'urgency', 'catastrophizing', 'rumination', 'exhaustion',
              'overwhelm', 'minimization', 'perfectionism', 'isolation',
            ],
          },
          score: { type: 'number', minimum: 0, maximum: 1 },
          evidence: { type: 'string', maxLength: 80 },
        },
      },
    },
    rawObservations: { type: 'string' },
  },
};

// ---------------------------------------------------------------------------
// Agent 2 — State Mapper (Tier 2 — Haiku)
// "You receive abstract pattern scores, never raw user text"
// Receives: PatternScorerOutput.patterns + sensor context (current state + breath BPM)
// Outputs: StateMapperOutput
// ---------------------------------------------------------------------------

const stateMapperPrompt = `\
You receive abstract pattern scores, never raw user text. \
Your role is to map these cognitive-linguistic pattern scores, combined with a brief sensor \
context (current nervous-system state and breath rate), into one of four display states that \
describe the user's current physiological-psychological window.

Display states (use exactly one of these values):
  steady      — regulated, no current pressure signals
  shifting    — early signs of escalation or perturbation; still in the window
  overloaded  — sustained or severe activation; outside the regulated window
  drained     — post-peak collapse or depletion; below baseline

You will receive a JSON object like:
{
  "patterns": [ { "key": "...", "score": ..., "evidence": "..." } ],
  "sensorState": "steady | shifting | overloaded | drained",
  "breathBpm": <number or null>
}

Your output must be:
- "state": one of the four display state values above
- "confidence": a number between 0 and 1
- "evidenceTrace": a plain-language summary of your reasoning, maximum 80 characters
- "leadTimeMinutes": (optional) estimated minutes until escalation — include ONLY when state is "shifting" or "overloaded"

Respond with ONLY valid JSON. Do not wrap in markdown code fences. Match this schema exactly:
{
  "state": "<DashboardState>",
  "confidence": <number 0..1>,
  "evidenceTrace": "<string, max 80 chars>",
  "leadTimeMinutes": <number> (optional — omit if state is steady or drained)
}`;

const stateMapperSchema: AgentSchema = {
  type: 'object',
  required: ['state', 'confidence', 'evidenceTrace'],
  properties: {
    state: {
      type: 'string',
      enum: ['steady', 'shifting', 'overloaded', 'drained'],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    evidenceTrace: { type: 'string', maxLength: 80 },
    leadTimeMinutes: { type: 'number', minimum: 0 },
  },
};

// ---------------------------------------------------------------------------
// Agent 3 — Reframe Writer (Tier 3 — Sonnet)
// "You receive pattern scores and a state, never raw user text"
// Receives: PatternScorerOutput.patterns + StateMapperOutput.state
// Outputs: ReframeWriterOutput
// ---------------------------------------------------------------------------

const reframeWriterPrompt = `\
You receive pattern scores and a state, never raw user text. \
Your role is to write a short, observational reframe for a person whose language has exhibited \
certain cognitive-linguistic patterns. The reframe is read by the person directly on their dashboard.

Voice rules (non-negotiable):
- 2 to 4 sentences. Never fewer, never more.
- No exclamation points (not even at the end).
- No imperative voice ("you should…", "try to…", "just…").
- Observational tone only: name what the language is doing, do not correct the person.
- Plain prose. No markdown, no bullet points, no headers.

You will receive a JSON object like:
{
  "patterns": [ { "key": "...", "score": ..., "evidence": "..." } ],
  "state": "steady | shifting | overloaded | drained"
}

You must also choose a breathing protocol that fits the detected state and write a one-line \
rationale (max 80 characters) explaining why you chose it.

Protocol options (use exactly one value):
  physiological_sigh   — best for acute activation or overload; fast exhale reset
  box_breath           — best for drained or low-energy states needing gentle re-engagement
  four_seven_eight     — best for high anxiety or rumination; longer hold extends calm

Your voiceCheck field must contain exactly one of these phrases:
  "observational, not corrective"
  "names what the language is doing"
  "two to four short sentences"

Respond with ONLY valid JSON. Do not wrap in markdown code fences. Match this schema exactly:
{
  "reframe": "<2–4 sentence observational reframe>",
  "voiceCheck": "<one of the three valid phrases>",
  "lengthWords": <integer word count of the reframe>,
  "protocol": "<physiological_sigh | box_breath | four_seven_eight>",
  "protocolReason": "<string, max 80 chars>"
}`;

const reframeWriterSchema: AgentSchema = {
  type: 'object',
  required: ['reframe', 'voiceCheck', 'lengthWords', 'protocol', 'protocolReason'],
  properties: {
    reframe: { type: 'string' },
    voiceCheck: {
      type: 'string',
      enum: [
        'observational, not corrective',
        'names what the language is doing',
        'two to four short sentences',
      ],
    },
    lengthWords: { type: 'integer', minimum: 1 },
    protocol: {
      type: 'string',
      enum: ['physiological_sigh', 'box_breath', 'four_seven_eight'],
    },
    protocolReason: { type: 'string', maxLength: 80 },
  },
};

// ---------------------------------------------------------------------------
// Exported spec object — single source of truth for all agent contracts
// ---------------------------------------------------------------------------

export const AGENT_SPECS = {
  patternScorer: {
    systemPrompt: patternScorerPrompt,
    tier: 1 as const,
    schema: patternScorerSchema,
  },
  stateMapper: {
    systemPrompt: stateMapperPrompt,
    tier: 2 as const,
    schema: stateMapperSchema,
  },
  reframeWriter: {
    systemPrompt: reframeWriterPrompt,
    tier: 3 as const,
    schema: reframeWriterSchema,
  },
} as const;

export type AgentName = keyof typeof AGENT_SPECS;
