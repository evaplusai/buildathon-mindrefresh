// StateBadge — small chip displaying the current 3-state classification.
//
// Color mapping (matches BreathGuide aesthetics):
//   regulated  → teal-400  (calm)
//   activated  → amber-400 (rising)
//   recovering → violet-400 (return)
//
// Pulses gently while in non-regulated states to draw the eye when the body
// is doing something other than baseline.

import type { State } from '../../types/state';

export interface StateBadgeProps {
  state: State;
}

const PALETTE: Record<State, { dot: string; ring: string; label: string }> = {
  regulated: {
    dot: 'bg-teal-400',
    ring: 'ring-teal-400/40',
    label: 'Regulated',
  },
  activated: {
    dot: 'bg-amber-400 animate-pulse',
    ring: 'ring-amber-400/40',
    label: 'Activated',
  },
  recovering: {
    dot: 'bg-violet-400 animate-pulse',
    ring: 'ring-violet-400/40',
    label: 'Recovering',
  },
};

export function StateBadge({ state }: StateBadgeProps) {
  const p = PALETTE[state];
  return (
    <span
      className={[
        'inline-flex items-center gap-2',
        'px-3 py-1 rounded-full',
        'bg-surface-800/80 border border-slate-700',
        'text-xs uppercase tracking-widest text-slate-200',
        'ring-1', p.ring,
      ].join(' ')}
      role="status"
      aria-label={`Current state: ${p.label.toLowerCase()}`}
    >
      <span className={`w-2 h-2 rounded-full ${p.dot}`} aria-hidden />
      <span>{p.label}</span>
    </span>
  );
}

export default StateBadge;
