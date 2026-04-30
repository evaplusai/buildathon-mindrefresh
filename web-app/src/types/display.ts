/**
 * Display bounded context — public type surface.
 * Implements DDD-07 §Public Interface, ADR-015, ADR-017.
 *
 * Ownership: foundation-coder (Sprint A Block 1).
 * Do NOT import from this file inside the State, Memory, Sensing, or
 * Reflection contexts — those own their own types.
 */

import type { State } from './state';

// ---------------------------------------------------------------------------
// 4-state display ladder (ADR-015)
// ---------------------------------------------------------------------------

export type DashboardState = 'steady' | 'shifting' | 'overloaded' | 'drained';

// ---------------------------------------------------------------------------
// Input to the 3→4 mapping function (ADR-015 §"The mapping")
// ---------------------------------------------------------------------------

export interface DashboardStateInput {
  /** 3-state worker classification — the trust anchor. */
  state: State;
  /** 0..1 from the most recent TriggerEvent.severity. */
  severity: number;
  /** Milliseconds since last StateTransition into `state`. */
  dwellMs: number;
  /** Current sample's breath rate in BPM (optional). */
  breathBpm?: number;
  /** User's regulated EWMA in BPM (from MorningCheckPayload.regulatedBaseline). */
  regulatedBaseline?: number;
  // V2 signals (ADR-017) — optional until fully wired
  /** 0..1 normalised proxy from hr_bpm / breath variance. */
  cardiacMicroMotion?: number;
  /** 0..1; higher = more still (frozen). Inverse of motion-band-power. */
  posturalStillness?: number;
  /** 0..1; higher = more movement. Short-window motion-band-power EWMA. */
  movementCadence?: number;
}

// ---------------------------------------------------------------------------
// Live Signals panel (ADR-017 §"Live Signals panel")
// ---------------------------------------------------------------------------

export interface SignalsFrame {
  /** Wall-clock timestamp of the latest contributing sample (ms since epoch). */
  ts: number;
  /** Raw breath rate in BPM — passed through without normalisation. */
  breathBpm: number;
  /** 0..1 normalised proxy for cardiac micro-motion. */
  cardiacMicroMotion: number;
  /** 0..1; 1 = frozen / fully still. Inverse of motion-band-power EWMA over 30 s. */
  posturalStillness: number;
  /** 0..1; higher = more movement. Short-window motion-band-power EWMA. */
  movementCadence: number;
  /** Whether the frame was derived from a live WebSocket or a recorded fixture. */
  source: 'live' | 'recorded';
}

// ---------------------------------------------------------------------------
// Pattern Mirror (ADR-017 §"Pattern Mirror")
// ---------------------------------------------------------------------------

export interface MirrorObservation {
  /** Observational prose — serif body, italic on the observational verb. */
  text: string;
  /** Mono caption — e.g. "9 of 12 days · correlation strong". */
  evidence: string;
  /** Icon key used by the PatternMirror component to pick the SVG. */
  iconKey: 'moon' | 'sun' | 'screen' | 'load';
  /** 0..1 confidence — affects rendering opacity. */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Today Strip (ADR-017 §"Today Strip")
// ---------------------------------------------------------------------------

export interface TodayStripData {
  /** Ordered state segments covering 6 AM → now (start/end in ms since epoch). */
  segments: { start: number; end: number; state: DashboardState }[];
  /** Timestamps of completed resets (ms since epoch). */
  resetMarkers: number[];
  stats: {
    /** Activated events detected before they escalated to overloaded. */
    shiftsCaughtToday: number;
    /** Mean minutes between shift detection and regulated return, this week. */
    avgLeadMinutesThisWeek: number;
    /** Minutes spent in `steady` state today. */
    steadyMinutesToday: number;
    /** Number of `overloaded`-or-drained events this week. */
    crashesThisWeek: number;
  };
}

// ---------------------------------------------------------------------------
// BreathProtocol — local alias for Sprint A.
// TODO(Sprint B): move to types/reflection.ts once the Reflection bounded
//   context ships its own type surface (DB-B1-T1). Import from there and
//   re-export here for backward compat.
// ---------------------------------------------------------------------------

export type BreathProtocol = 'physiological_sigh' | 'box_breath' | 'four_seven_eight';
