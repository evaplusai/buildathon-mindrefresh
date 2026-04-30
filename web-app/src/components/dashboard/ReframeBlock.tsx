/**
 * ReframeBlock — renders Agent 3's reframe with reveal animation.
 *
 * Per design HTML lines 941–945 (`.affirmation`) and ADR-016/ADR-018.
 *
 * Render:
 *   - Eyebrow: "REVERSE AFFIRMATION · WHAT YOUR LANGUAGE IS SAYING"
 *   - Big serif reframe text with italic on the first observational verb phrase.
 *   - Meta line: state + pattern keys in mono caps.
 *   - Optional protocol line (ADR-018) if `protocol` prop is set.
 *
 * Reveal animation: opacity 0 → 1 + translateY(8px → 0) on mount.
 *
 * Ownership: ui-coder (Sprint B Block 3).
 */

import { useEffect, useState } from 'react';
import type { DashboardState, BreathProtocol } from '../../types/display';
import type { PatternKey } from '../../types/reflection';

export interface ReframeBlockProps {
  reframe: string;
  state: DashboardState;
  patternKeys: PatternKey[];
  protocol?: BreathProtocol;
  protocolReason?: string;
}

// ---------------------------------------------------------------------------
// Observational verb-phrase italiciser
// Heuristic: find the first occurrence of a known observational verb in the
// reframe text; wrap the word in <em>. If none found, render as plain text.
// ---------------------------------------------------------------------------

const OBSERVATIONAL_VERBS = [
  'narrows', 'narrowing', 'narrows',
  'shifting', 'shifts',
  'rising', 'rises',
  'tightens', 'tightening',
  'loops', 'looping',
  'minimizing', 'minimizes',
  'racing', 'races',
  'scanning', 'scans',
  'holding', 'holds',
  'bracing', 'braces',
  'contracting', 'contracts',
  'accelerating', 'accelerates',
];

function italiciseVerb(text: string): React.ReactNode {
  for (const verb of OBSERVATIONAL_VERBS) {
    // Case-insensitive whole-word match
    const re = new RegExp(`(\\b)(${verb})(\\b)`, 'i');
    const match = re.exec(text);
    if (match) {
      const before = text.slice(0, match.index + match[1].length);
      const matched = match[2];
      const after = text.slice(match.index + match[1].length + matched.length);
      return (
        <>
          {before}
          <em className="italic">{matched}</em>
          {after}
        </>
      );
    }
  }
  return text;
}

// ---------------------------------------------------------------------------
// Protocol label mapping
// ---------------------------------------------------------------------------

const PROTOCOL_LABEL: Record<BreathProtocol, string> = {
  physiological_sigh: 'Physiological sigh',
  box_breath: 'Box breath',
  four_seven_eight: '4-7-8 breath',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReframeBlock({ reframe, state, patternKeys, protocol, protocolReason }: ReframeBlockProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger the reveal on mount via a short RAF delay so CSS transition fires
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const metaState = state.toUpperCase();
  const metaPatterns = patternKeys.map(k => k.toUpperCase()).join(' · ');

  return (
    <div
      className={[
        'mt-6 pt-6 border-t border-marketing-line',
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      ].join(' ')}
      aria-live="polite"
      aria-label="Reverse affirmation"
    >
      {/* Eyebrow */}
      <div className="font-mono text-[10px] tracking-[2px] text-marketing-inkMuted uppercase font-semibold mb-3">
        Reverse affirmation &middot; what your language is saying
      </div>

      {/* Reframe text */}
      <p className="font-serif text-[20px] leading-[1.55] text-marketing-green-900 font-medium tracking-[-0.2px] mb-3">
        {italiciseVerb(reframe)}
      </p>

      {/* Meta line */}
      <div className="font-mono text-[10px] tracking-[1.5px] text-marketing-inkMuted uppercase">
        State: {metaState}
        {metaPatterns ? ` · Language patterns: ${metaPatterns}` : ''}
      </div>

      {/* Protocol advisory (ADR-018) */}
      {protocol && (
        <div className="mt-2 font-mono text-[10px] tracking-[0.5px] text-marketing-green-700">
          Suggested protocol: {PROTOCOL_LABEL[protocol]}
          {protocolReason ? ` — ${protocolReason}` : ''}
        </div>
      )}
    </div>
  );
}

export default ReframeBlock;
