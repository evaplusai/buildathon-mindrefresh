// BreathGuide — animated breathing circle paced by the active BreathPattern.
//
// • `natural`         — paces to the user's live `breathBpm` (defaults to 12).
// • `cyclic_sigh`     — 2 short inhales then 1 long exhale (~5 s cycle), per
//                       Yilmaz Balban et al. 2023.
// • `extended_exhale` — 4 s in / 6 s out (~10 s cycle), per Porges 2011.
//
// The keyframes are inlined as a single <style> block so we don't have to
// extend tailwind.config.js — keeps the change surface tight (Sprint C rule:
// "no new deps, no surprise config edits").

import type { BreathPattern } from '../../types/intervention';

export interface BreathGuideProps {
  pattern: BreathPattern;
  /** User's live breath rate; only consulted for `natural`. */
  breathBpm?: number;
}

const KEYFRAMES = `
@keyframes mr-breath-natural {
  0%   { transform: scale(0.7); box-shadow: 0 0 24px 4px rgba(34, 211, 238, 0.15); }
  50%  { transform: scale(1.0); box-shadow: 0 0 64px 16px rgba(34, 211, 238, 0.45); }
  100% { transform: scale(0.7); box-shadow: 0 0 24px 4px rgba(34, 211, 238, 0.15); }
}
@keyframes mr-breath-cyclic-sigh {
  0%   { transform: scale(0.7);  box-shadow: 0 0 24px 4px rgba(245, 158, 11, 0.15); }
  20%  { transform: scale(0.88); box-shadow: 0 0 48px 12px rgba(245, 158, 11, 0.35); }
  30%  { transform: scale(0.82); box-shadow: 0 0 36px 8px rgba(245, 158, 11, 0.25); }
  50%  { transform: scale(1.00); box-shadow: 0 0 64px 18px rgba(245, 158, 11, 0.50); }
  100% { transform: scale(0.7);  box-shadow: 0 0 24px 4px rgba(245, 158, 11, 0.15); }
}
@keyframes mr-breath-extended-exhale {
  0%   { transform: scale(0.7); box-shadow: 0 0 24px 4px rgba(139, 92, 246, 0.15); }
  40%  { transform: scale(1.0); box-shadow: 0 0 64px 16px rgba(139, 92, 246, 0.45); }
  100% { transform: scale(0.7); box-shadow: 0 0 24px 4px rgba(139, 92, 246, 0.15); }
}
@media (prefers-reduced-motion: reduce) {
  .mr-breath-circle { animation: none !important; transform: scale(0.85); }
}
`;

/**
 * Pick the keyframe + duration for a pattern. `natural` paces to the live
 * breath; the other two patterns are clinically fixed.
 */
function animationFor(pattern: BreathPattern, breathBpm?: number): {
  name: string;
  durationSec: number;
  label: string;
} {
  switch (pattern) {
    case 'cyclic_sigh':
      return { name: 'mr-breath-cyclic-sigh', durationSec: 5, label: 'Cyclic sigh — two short inhales, one long exhale' };
    case 'extended_exhale':
      return { name: 'mr-breath-extended-exhale', durationSec: 10, label: 'Extended exhale — 4 in, 6 out' };
    case 'natural':
    default: {
      const bpm = breathBpm && breathBpm > 0 ? breathBpm : 12;
      return {
        name: 'mr-breath-natural',
        durationSec: 60 / bpm,
        label: `Natural follow at ${Math.round(bpm)} BPM`,
      };
    }
  }
}

export function BreathGuide({ pattern, breathBpm }: BreathGuideProps) {
  const anim = animationFor(pattern, breathBpm);

  return (
    <div
      className="relative flex items-center justify-center w-full py-10"
      role="img"
      aria-label={anim.label}
    >
      <style>{KEYFRAMES}</style>
      <div
        className="mr-breath-circle w-32 h-32 rounded-full bg-gradient-to-br from-accent-cyan/20 to-accent-violet/30"
        style={{
          animationName: anim.name,
          animationDuration: `${anim.durationSec}s`,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
        }}
      />
    </div>
  );
}

export default BreathGuide;
