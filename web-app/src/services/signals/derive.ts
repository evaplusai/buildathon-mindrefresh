/**
 * Live signal derivation from VitalsRingBuffer → SignalsFrame.
 *
 * Implements ADR-017 §"Live Signals panel" derivation table:
 *   - breathBpm: raw pass-through from latest sample
 *   - cardiacMicroMotion: 0..1 normalised from hr_bpm or breath-rate variance proxy
 *   - posturalStillness: 0..1; inverse of motion-band-power EWMA over 30s
 *   - movementCadence: 0..1; motion-band-power short-window EWMA
 *
 * Returns null when the latest frame indicates presence === false (room empty).
 *
 * Ownership: foundation-coder (Sprint A Block 1, task DA-B1-T4).
 */

import type { VitalsFrame } from '../../types/vitals';
import type { VitalsRingBuffer } from '../vitalsRingBuffer';
import type { SignalsFrame } from '../../types/display';
import {
  ewma,
  variance,
  clamp,
  linearMap,
  motionPowers,
  breathValues,
  anyAbsent,
} from './bufferAccess';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 30-second window for postural stillness + cardiac proxy derivations. */
const WINDOW_30S = 30_000;

/** Short 5-second window for movement cadence — more responsive. */
const WINDOW_5S = 5_000;

/**
 * hr_bpm normalisation range (BPM): maps [50..100] linearly to [0..1].
 * Values outside this range are clamped to [0,1].
 * Source: ADR-017 §"Live Signals panel".
 */
const HR_MIN_BPM = 50;
const HR_MAX_BPM = 100;

/**
 * Breath-rate variance normalisation for cardiac proxy when hr_bpm is absent.
 * Empirical: variance of ~0 BPM² = settled; ~4 BPM² = high variability.
 * Maps [0..4] → [0..1] linearly; clamped.
 */
const BREATH_VAR_MAX = 4;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derives four live signal values from the current ring-buffer contents.
 *
 * @param buffer - The shared VitalsRingBuffer. Not mutated.
 * @param source - Whether the buffer is fed from a live WebSocket or a
 *                 recorded fixture. Passed through to the SignalsFrame.
 * @returns A SignalsFrame with all four values, or null if presence is false
 *          (caller should render "—" for all bars).
 */
export function deriveSignals(
  buffer: VitalsRingBuffer,
  source: 'live' | 'recorded',
): SignalsFrame | null {
  const latest = buffer.latest();

  // No data yet — return null so the UI can show a loading / idle state.
  if (!latest) return null;

  // Room-empty sentinel: any absence in the 30s window is enough.
  const samples30 = buffer.samplesIn(WINDOW_30S);
  if (samples30.length === 0 || anyAbsent(samples30)) return null;

  // Also check the latest frame specifically (presence may have just changed)
  if (!latest.presence) return null;

  // -------------------------------------------------------------------------
  // breathBpm — raw pass-through
  // -------------------------------------------------------------------------
  const breathBpm = latest.breathBpm ?? buffer.meanBreath(WINDOW_30S) ?? 0;

  // -------------------------------------------------------------------------
  // cardiacMicroMotion — 0..1 normalised
  //
  // Primary path: hr_bpm from the latest sample.
  // Fallback:     variance of breath rate over the 30s window acts as a proxy
  //               for the heart-rate variability signal we can't directly read.
  //               Higher breath variability → higher "micro-motion" proxy.
  // -------------------------------------------------------------------------
  const cardiacMicroMotion = deriveCardiacMicroMotion(latest.hrBpm, samples30);

  // -------------------------------------------------------------------------
  // posturalStillness — 0..1; 1 = frozen
  //
  // Inverse of motion-band-power EWMA over 30s. High power → low stillness.
  // Clamp to [0,1]; never negative.
  // -------------------------------------------------------------------------
  const posturalStillness = derivePosturalStillness(samples30);

  // -------------------------------------------------------------------------
  // movementCadence — 0..1
  //
  // Motion-band-power short-window EWMA (5s). Captures bursts of movement
  // that the 30s window would average away.
  // -------------------------------------------------------------------------
  const samples5 = buffer.samplesIn(WINDOW_5S);
  const movementCadence = deriveMovementCadence(
    samples5.length > 0 ? samples5 : samples30,
  );

  return {
    ts: latest.ts,
    breathBpm,
    cardiacMicroMotion,
    posturalStillness,
    movementCadence,
    source,
  };
}

// ---------------------------------------------------------------------------
// Internal derivation helpers
// ---------------------------------------------------------------------------

function deriveCardiacMicroMotion(
  hrBpm: number | undefined,
  samples30: VitalsFrame[],
): number {
  // Primary: direct hr_bpm normalisation
  if (hrBpm != null && hrBpm > 0) {
    const mapped = linearMap(hrBpm, HR_MIN_BPM, HR_MAX_BPM, 0, 1);
    return clamp(mapped, 0, 1);
  }

  // Fallback: breath-rate variance proxy
  const breathVals = breathValues(samples30);
  if (breathVals.length >= 2) {
    const bv = variance(breathVals);
    const mapped = linearMap(bv, 0, BREATH_VAR_MAX, 0, 1);
    return clamp(mapped, 0, 1);
  }

  // No data available — return 0 (neutral, not null — caller gets a number)
  return 0;
}

function derivePosturalStillness(
  samples30: Parameters<typeof motionPowers>[0],
): number {
  const powers = motionPowers(samples30);
  if (powers.length === 0) return 1; // no movement data → assume still

  const avgPower = ewma(powers);
  if (avgPower === undefined) return 1;

  // Normalise: we don't know the sensor's absolute scale, so we treat the
  // in-window maximum as the ceiling for a relative [0..1] mapping.
  // This is a session-relative normalisation; it means the signal is
  // calibrated per-session rather than per-device.
  const maxPower = Math.max(...powers);
  if (maxPower === 0) return 1; // zero motion throughout → fully still

  const relativeMotion = clamp(avgPower / maxPower, 0, 1);
  // Invert: high motion = low stillness
  return clamp(1 - relativeMotion, 0, 1);
}

function deriveMovementCadence(
  samplesWindow: Parameters<typeof motionPowers>[0],
): number {
  const powers = motionPowers(samplesWindow);
  if (powers.length === 0) return 0;

  const avgPower = ewma(powers);
  if (avgPower === undefined) return 0;

  // Same session-relative normalisation as posturalStillness.
  const maxPower = Math.max(...powers);
  if (maxPower === 0) return 0;

  return clamp(avgPower / maxPower, 0, 1);
}
