// AffirmationCard — visual port of upstream/mind-refresh-05/.../result/AffirmationCard.tsx.
//
// Differences from the upstream component:
//   • The new schema (src/types/intervention.ts) has no `scripture` /
//     `reference` fields, so those rendering branches are dropped (per
//     Intervention DDD anti-corruption layer).
//   • Adds 3 small feedback buttons (helped / neutral / unhelpful) wired to
//     the `onFeedback` callback, which Dashboard forwards into the Memory
//     context once Track 1 lands the `appendFeedback` plumbing.
//   • Animation behaviour — opacity / translate-y / scale on mount — is kept
//     verbatim, and `motion-reduce` overrides are preserved.

import { useEffect, useState } from 'react';
import { Heart, Minus, X } from 'lucide-react';
import type { Affirmation } from '../../types/intervention';

export type FeedbackSignal = 'helped' | 'neutral' | 'unhelpful';

export interface AffirmationCardProps {
  affirmation: Affirmation;
  onFeedback?: (signal: FeedbackSignal) => void;
  /** Stagger the entrance to give the BreathGuide a beat to settle. */
  animationDelayMs?: number;
}

export function AffirmationCard({
  affirmation,
  onFeedback,
  animationDelayMs = 300,
}: AffirmationCardProps) {
  // Reset visibility when the affirmation id changes by keying the visibility
  // state on the id. We avoid `setIsVisible(false)` inside the effect (which
  // tripped react-hooks/set-state-in-effect) by deriving the initial value
  // from `false` and only flipping to `true` after the timer fires.
  const [visibleForId, setVisibleForId] = useState<string | null>(null);
  const isVisible = visibleForId === affirmation.id;

  useEffect(() => {
    const id = affirmation.id;
    const t = setTimeout(() => setVisibleForId(id), animationDelayMs);
    return () => clearTimeout(t);
    // Re-run when the underlying affirmation changes so each new pick gets
    // its own fade-in beat.
  }, [affirmation.id, animationDelayMs]);

  return (
    <div
      className={[
        'max-w-2xl mx-auto px-8 py-10',
        'bg-surface-800/80 backdrop-blur-xl',
        'rounded-2xl shadow-2xl',
        'border border-slate-700/50',
        'transition-all duration-1000 ease-out',
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-8 scale-95',
        'motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100',
      ].join(' ')}
      role="region"
      aria-live="polite"
      aria-label="A somatic affirmation"
    >
      <div className="flex justify-center mb-6">
        <div className="w-12 h-1 bg-gradient-to-r from-accent-cyan/40 to-accent-cyan rounded-full" />
      </div>

      <blockquote className="text-center m-0">
        <p className="text-2xl sm:text-3xl leading-relaxed text-slate-100">
          &ldquo;{affirmation.text}&rdquo;
        </p>
      </blockquote>

      {onFeedback && (
        <div className="mt-8 flex items-center justify-center gap-3" role="group" aria-label="Affirmation feedback">
          <FeedbackButton
            label="Helped"
            tone="helped"
            onClick={() => onFeedback('helped')}
            icon={<Heart size={16} aria-hidden />}
          />
          <FeedbackButton
            label="Neutral"
            tone="neutral"
            onClick={() => onFeedback('neutral')}
            icon={<Minus size={16} aria-hidden />}
          />
          <FeedbackButton
            label="Unhelpful"
            tone="unhelpful"
            onClick={() => onFeedback('unhelpful')}
            icon={<X size={16} aria-hidden />}
          />
        </div>
      )}
    </div>
  );
}

interface FeedbackButtonProps {
  label: string;
  tone: FeedbackSignal;
  onClick: () => void;
  icon: React.ReactNode;
}

function FeedbackButton({ label, tone, onClick, icon }: FeedbackButtonProps) {
  const tonePalette: Record<FeedbackSignal, string> = {
    helped: 'hover:border-accent-cyan/60 hover:text-accent-cyan',
    neutral: 'hover:border-slate-400/60 hover:text-slate-200',
    unhelpful: 'hover:border-rose-400/60 hover:text-rose-300',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Mark this affirmation as ${label.toLowerCase()}`}
      className={[
        'inline-flex items-center gap-2',
        'px-3 py-1.5 rounded-full',
        'text-xs uppercase tracking-wide',
        'border border-slate-700 text-slate-400',
        'transition-colors duration-200',
        tonePalette[tone],
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default AffirmationCard;
