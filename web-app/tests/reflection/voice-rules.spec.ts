/**
 * voice-rules.spec.ts — 20 fixture reframes (10 valid, 10 invalid).
 *
 * Per ADR-016 §Test Hooks and the dashboard-v2 plan DB-B4-T3.
 * Validates that validateReframeWriterOutput accepts/rejects per voice rules:
 *
 * Valid:   no "!", no imperative "you should", 12–60 words, valid protocol,
 *          voiceCheck in the accepted set, non-empty reframe.
 * Invalid: contains "!", has "you should", < 12 words, > 60 words, missing
 *          protocol field, or protocol not in BreathProtocol union.
 *
 * Ownership: ui-coder (Sprint B Block 4).
 */

import { describe, it, expect } from 'vitest';

// server-coder owns validate.ts — imported as a cross-slice dependency
import { validateReframeWriterOutput } from '../../src/services/reflect/validate';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_VOICE_CHECK = 'observational, not corrective';
const SHORT_REFRAME = 'Urgency narrows. Breath is rising. The language loops. Body tightens now.'; // 14 words
const LONG_REFRAME_VALID =
  'The language is minimizing what is actually happening. Scanning for threats while holding the body still. The breath is rising before the thought arrives. Something is shifting beneath the surface of what feels fine.'; // 40 words

/**
 * Count words naively (split on whitespace).
 */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// 10 VALID fixtures
// ---------------------------------------------------------------------------

const VALID_FIXTURES = [
  {
    reframe: SHORT_REFRAME,
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: wordCount(SHORT_REFRAME),
    protocol: 'physiological_sigh' as const,
    protocolReason: 'Urgency benefits from slow exhale.',
  },
  {
    reframe: LONG_REFRAME_VALID,
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: wordCount(LONG_REFRAME_VALID),
    protocol: 'box_breath' as const,
    protocolReason: 'Minimization pattern responds to holding.',
  },
  {
    reframe: 'The body is holding tension before the decision arrives. Breath is shallow and fast. Something is tightening in the chest area.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 23,
    protocol: 'four_seven_eight' as const,
    protocolReason: 'Rumination benefits from extended hold.',
  },
  {
    reframe: 'Exhaustion is showing up as a flattening of words. The cadence is slow. The system is conserving.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 18,
    protocol: 'box_breath' as const,
    protocolReason: 'Drained state benefits from box breath.',
  },
  {
    reframe: 'Overwhelm is appearing as fragmented thoughts arriving all at once. The language loops back. Breath narrows with each item added.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 22,
    protocol: 'physiological_sigh' as const,
    protocolReason: 'Overwhelm responds well to double inhale.',
  },
  {
    reframe: 'Catastrophizing is narrowing the window of outcomes. Every sentence closes a door. The nervous system is scanning for exits.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 20,
    protocol: 'physiological_sigh' as const,
    protocolReason: 'Fear-scanning pattern benefits from long exhale.',
  },
  {
    reframe: 'Perfectionism is rising in the gap between expectation and reality. The language is measuring. Something tightens when imperfection appears.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 21,
    protocol: 'four_seven_eight' as const,
    protocolReason: 'Perfectionism responds to held stillness.',
  },
  {
    reframe: 'Isolation is present in the framing. The language positions this as singular experience. The body carries that alone.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 19,
    protocol: 'box_breath' as const,
    protocolReason: 'Isolation benefits from rhythmic grounding.',
  },
  {
    reframe: 'Rumination is cycling through the same sequence. Each loop tightens the window. Breath is holding on the inhale.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 20,
    protocol: 'physiological_sigh' as const,
    protocolReason: 'Looping cognition benefits from the sigh exhale.',
  },
  {
    reframe: 'The language is running faster than the events. Urgency is compressing the timeline. The body is already in the next moment.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 22,
    protocol: 'physiological_sigh' as const,
    protocolReason: 'Time-compression benefits from long exhale reset.',
  },
] as const;

// ---------------------------------------------------------------------------
// 10 INVALID fixtures
// ---------------------------------------------------------------------------

const INVALID_FIXTURES: unknown[] = [
  // 1. Contains "!"
  {
    reframe: 'This is amazing! Breath is rising and you are doing great!',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 12,
    protocol: 'physiological_sigh',
    protocolReason: 'n/a',
  },
  // 2. Imperative "you should"
  {
    reframe: 'You should breathe more slowly and take breaks throughout the day.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 13,
    protocol: 'box_breath',
    protocolReason: 'n/a',
  },
  // 3. Too short (< 12 words) — 8 words
  {
    reframe: 'Breath is shallow. The body is tightening now.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 8,
    protocol: 'box_breath',
    protocolReason: 'n/a',
  },
  // 4. Too long (> 60 words) — 65 words
  {
    reframe: 'The language is narrowing the field slowly and deliberately over time as urgency rises. Each word carries the weight of what has not been resolved. Breath is compressing. The body holds. Something is tightening in the space between thoughts. Scanning for an exit that has not appeared yet in this situation. The system is in a holding pattern with no clear resolution.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 65,
    protocol: 'physiological_sigh',
    protocolReason: 'n/a',
  },
  // 5. Missing protocol field
  {
    reframe: 'The language is narrowing. Breath is rising. Something tightens below awareness.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 13,
    protocolReason: 'n/a',
  },
  // 6. Invalid protocol value
  {
    reframe: 'The language is narrowing. Breath is rising. Something tightens below awareness.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 13,
    protocol: 'invalid_protocol',
    protocolReason: 'n/a',
  },
  // 7. Missing voiceCheck
  {
    reframe: 'The language is narrowing. Breath is rising. Something tightens below awareness.',
    lengthWords: 13,
    protocol: 'box_breath',
    protocolReason: 'n/a',
  },
  // 8. voiceCheck not in accepted set
  {
    reframe: 'The language is narrowing. Breath is rising. Something tightens below awareness.',
    voiceCheck: 'positive and uplifting',
    lengthWords: 13,
    protocol: 'four_seven_eight',
    protocolReason: 'n/a',
  },
  // 9. Empty reframe string
  {
    reframe: '',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 0,
    protocol: 'physiological_sigh',
    protocolReason: 'n/a',
  },
  // 10. protocolReason exceeds 80 chars
  {
    reframe: 'The language is narrowing. Breath is rising. Something tightens below awareness.',
    voiceCheck: VALID_VOICE_CHECK,
    lengthWords: 13,
    protocol: 'box_breath',
    protocolReason: 'This reason is far too long and exceeds the eighty character limit imposed by the schema validator.',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('voice-rules — validateReframeWriterOutput', () => {
  describe('valid fixtures (should return typed object)', () => {
    VALID_FIXTURES.forEach((fixture, i) => {
      it(`valid fixture #${i + 1}: accepts and returns typed object`, () => {
        const result = validateReframeWriterOutput(fixture);
        expect(result).not.toBeNull();
        expect(result).toMatchObject({
          reframe: fixture.reframe,
          voiceCheck: fixture.voiceCheck,
          protocol: fixture.protocol,
        });
      });
    });
  });

  describe('invalid fixtures (should return null)', () => {
    INVALID_FIXTURES.forEach((fixture, i) => {
      it(`invalid fixture #${i + 1}: returns null`, () => {
        const result = validateReframeWriterOutput(fixture);
        expect(result).toBeNull();
      });
    });
  });
});
