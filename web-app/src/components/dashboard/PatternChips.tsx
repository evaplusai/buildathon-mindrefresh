/**
 * PatternChips — colour-coded chip row for Agent 1's PatternScore array.
 *
 * Per design HTML CSS for `.pattern-chips` and DDD-06 §"PatternLevel".
 * Chips are pre-sorted desc by score (caller's responsibility); capped at 3.
 *
 * PatternLevel mapping:
 *   score >= 0.5  → high  (rose)
 *   score >= 0.2  → med   (amber)
 *   else          → low   (subtle green)
 *
 * Ownership: ui-coder (Sprint B Block 3).
 */

import type { PatternScore } from '../../types/reflection';

export interface PatternChipsProps {
  /** Pre-sorted desc by score, capped at 3. */
  chips: PatternScore[];
}

function levelClass(score: number): string {
  if (score >= 0.5) {
    return 'bg-marketing-rose/15 text-marketing-rose';
  }
  if (score >= 0.2) {
    return 'bg-[#C99B4F]/15 text-[#C99B4F]';
  }
  return 'bg-marketing-green-50 text-marketing-green-800';
}

function formatKey(key: string): string {
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

export function PatternChips({ chips }: PatternChipsProps) {
  const visible = chips.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-2 mt-1"
      aria-label="Detected language patterns"
    >
      {visible.map((chip) => (
        <span
          key={chip.key}
          className={[
            'inline-flex items-center px-2.5 py-1 rounded-full',
            'font-mono text-[11px] tracking-[0.5px] font-semibold',
            levelClass(chip.score),
          ].join(' ')}
        >
          {formatKey(chip.key)} &middot; {(chip.score * 100).toFixed(0)}%
        </span>
      ))}
    </div>
  );
}

export default PatternChips;
