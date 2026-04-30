/**
 * Thin accessor helpers over VitalsRingBuffer for the signal derivation
 * functions in derive.ts.
 *
 * This file exists because derive.ts needs computation that is not part of
 * VitalsRingBuffer's V1 surface (variance, EWMA). Rather than modifying the
 * existing buffer class — which is used by the worker and the classifier —
 * we add stateless helpers here that consume the public `samplesIn()` method.
 *
 * Ownership: foundation-coder (Sprint A Block 1, task DA-B1-T4).
 */

import type { VitalsFrame } from '../../types/vitals';

/**
 * Exponentially-weighted moving average over an array of numbers.
 * Alpha = 2 / (n + 1) where n = samples.length.
 * Returns the final EWMA value; undefined for empty input.
 */
export function ewma(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];
  const alpha = 2 / (values.length + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result;
  }
  return result;
}

/**
 * Sample variance of an array of numbers.
 * Returns 0 for arrays with fewer than 2 elements.
 */
export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
}

/**
 * Clamps `value` to [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linearly maps `value` from the range [inMin, inMax] to [outMin, outMax].
 * Returns `outMin` if inMin === inMax (degenerate range).
 */
export function linearMap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Extracts motionBandPower values from a sample window.
 */
export function motionPowers(samples: VitalsFrame[]): number[] {
  return samples.map((s) => s.motionBandPower);
}

/**
 * Extracts breathBpm values from a sample window (filters out nullish values).
 */
export function breathValues(samples: VitalsFrame[]): number[] {
  return samples
    .filter((s) => s.breathBpm != null)
    .map((s) => s.breathBpm!);
}

/**
 * Returns true if *any* of the supplied samples has presence === false.
 * A single "room empty" frame in the window is enough to invalidate the
 * derivation and return null from deriveSignals.
 */
export function anyAbsent(samples: VitalsFrame[]): boolean {
  return samples.some((s) => s.presence === false);
}
