/**
 * BreathingModal — full-screen breathing reset overlay.
 *
 * Per ADR-018 and design HTML lines 533–599 (styles), 1025–1046 (markup),
 * 1402–1474 (logic).
 *
 * Requirements:
 * - Rendered via createPortal into document.getElementById('modal-root')
 * - role="dialog" + aria-modal="true" + aria-labelledby (protocol title)
 * - Focus trap: on open → close button. Tab cycles within modal. Restore on close.
 * - Dismissal: ESC, backdrop click, close button, "RETURN TO TODAY" (completion screen).
 *   All paths call onClose(completed: boolean).
 * - prefers-reduced-motion: discrete per-phase scales, no glow animation, no dot pulse.
 * - Protocol loop via breathProtocols.json timing.
 * - Progress dots: protocol.rounds count (5 for sigh, 4 for box/4-7-8).
 * - Completion: after final round → fade orb → checkmark + "You're back in the window."
 * - Props: protocol (resolved by parent), isOpen, onClose(completed).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BreathProtocol } from '../../types/display';
import breathProtocolsData from '../../data/breathProtocols.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhaseConfig {
  label: string;
  durationMs: number;
  instruction: string;
}

interface ProtocolConfig {
  rounds: number;
  phases: PhaseConfig[];
}

type ProtocolMap = {
  [K in BreathProtocol]: ProtocolConfig;
};

const PROTOCOLS = breathProtocolsData as unknown as ProtocolMap;

export interface BreathingModalProps {
  /** The resolved protocol — do NOT call resolveProtocol here; the parent passes it. */
  protocol: BreathProtocol;
  isOpen: boolean;
  /** Called when the modal closes. completed=true only if all rounds finished. */
  onClose: (completed: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse <em>…</em> in instruction text into JSX nodes. */
function parseInstruction(text: string): React.ReactNode {
  const parts = text.split(/(<em>[^<]*<\/em>)/);
  return parts.map((part, i) => {
    const match = part.match(/^<em>(.*)<\/em>$/);
    if (match) {
      return (
        <em key={i} style={{ color: 'var(--green-100, #C0DD97)', fontStyle: 'italic' }}>
          {match[1]}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const PROTOCOL_LABEL: Record<BreathProtocol, string> = {
  physiological_sigh: 'PHYSIOLOGICAL SIGH',
  box_breath: 'BOX BREATH',
  four_seven_eight: '4-7-8 BREATH',
};

/** Orb class based on the phase label from the JSON. */
function orbPhaseStyle(label: string, reducedMotion: boolean): React.CSSProperties {
  if (reducedMotion) {
    if (label === 'Inhale' || label === 'Top-up') return { transform: 'scale(1)' };
    if (label === 'Hold') return { transform: 'scale(1)' };
    return { transform: 'scale(0.55)' };
  }
  if (label === 'Inhale' || label === 'Top-up') {
    return { transform: 'scale(1)', transition: 'transform 2s cubic-bezier(0.45,0,0.55,1)' };
  }
  if (label === 'Hold') {
    return { transform: 'scale(1)', transition: 'transform 2s ease' };
  }
  // Exhale
  return { transform: 'scale(0.55)', transition: 'transform 6s cubic-bezier(0.45,0,0.55,1)' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BreathingModal({ protocol, isOpen, onClose }: BreathingModalProps) {
  const [instruction, setInstruction] = useState<React.ReactNode>('Get comfortable. Eyes soft.');
  const [orbStyle, setOrbStyle] = useState<React.CSSProperties>({ transform: 'scale(0.55)' });
  const [currentRound, setCurrentRound] = useState(0);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [instructionOpacity, setInstructionOpacity] = useState(1);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const openTsRef = useRef<number>(0);
  const completedRef = useRef(false);

  // Detect reduced motion preference
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------
  // Clear all pending timers
  // ---------------------------------------------------------------------------
  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // ---------------------------------------------------------------------------
  // Orb step helper (mirrors design HTML runBreathSequence logic)
  // ---------------------------------------------------------------------------
  const step = useCallback(
    (
      text: React.ReactNode,
      phaseLabel: string,
      duration: number,
      after: () => void,
    ) => {
      setInstructionOpacity(0);
      schedule(() => {
        setInstruction(text);
        setInstructionOpacity(1);
      }, 250);
      setOrbStyle(orbPhaseStyle(phaseLabel, reducedMotion));
      schedule(after, duration);
    },
    [schedule, reducedMotion],
  );

  // ---------------------------------------------------------------------------
  // Run one full protocol sequence
  // ---------------------------------------------------------------------------
  const runProtocol = useCallback(() => {
    const config = PROTOCOLS[protocol];
    if (!config) return;

    const { rounds, phases } = config;
    let roundIndex = 0;
    completedRef.current = false;

    function doRound() {
      if (roundIndex >= rounds) {
        // All rounds done — show completion screen
        schedule(() => {
          setIsComplete(true);
          completedRef.current = true;
        }, 500);
        return;
      }

      setCurrentRound(roundIndex);

      // Chain through phases sequentially
      function doPhase(phaseIndex: number) {
        if (phaseIndex >= phases.length) {
          setCompletedRounds(roundIndex + 1);
          roundIndex++;
          doRound();
          return;
        }

        const phase = phases[phaseIndex];
        const text = parseInstruction(phase.instruction);

        step(text, phase.label, phase.durationMs, () => {
          doPhase(phaseIndex + 1);
        });
      }

      doPhase(0);
    }

    doRound();
  }, [protocol, step, schedule]);

  // ---------------------------------------------------------------------------
  // Close handler — unified for all dismissal paths
  // ---------------------------------------------------------------------------
  const handleClose = useCallback(
    (wasCompleted: boolean) => {
      clearTimers();
      openerRef.current?.focus();
      onClose(wasCompleted);
    },
    [clearTimers, onClose],
  );

  // ---------------------------------------------------------------------------
  // Open/close effects
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    // Save opener for focus restoration
    openerRef.current = document.activeElement as HTMLElement | null;
    openTsRef.current = Date.now();
    completedRef.current = false;

    // Defer state resets to a microtask to satisfy React 19's
    // react-hooks/set-state-in-effect rule.
    schedule(() => {
      setInstruction('Get comfortable. Eyes soft.');
      setOrbStyle({ transform: 'scale(0.55)' });
      setCurrentRound(0);
      setCompletedRounds(0);
      setIsComplete(false);
      setInstructionOpacity(1);
    }, 0);

    // Initial focus
    schedule(() => {
      closeButtonRef.current?.focus();
    }, 50);

    // Start protocol
    schedule(() => {
      runProtocol();
    }, 800);

    return () => {
      clearTimers();
    };
  }, [isOpen, runProtocol, schedule, clearTimers]);

  // ---------------------------------------------------------------------------
  // ESC key listener
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose(completedRef.current);
        return;
      }

      // Focus trap — Tab / Shift+Tab cycles within modal
      if (e.key === 'Tab') {
        const focusable = [closeButtonRef.current, returnButtonRef.current].filter(
          Boolean,
        ) as HTMLElement[];

        if (focusable.length <= 1) {
          e.preventDefault();
          focusable[0]?.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const config = PROTOCOLS[protocol];
  const totalRounds = config?.rounds ?? 5;
  const protocolLabel = PROTOCOL_LABEL[protocol] ?? 'RESET PROTOCOL';

  // ---------------------------------------------------------------------------
  // Portal render
  // ---------------------------------------------------------------------------
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{
        background: 'rgba(15,26,4,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: reducedMotion ? undefined : 'backdropIn 0.5s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose(completedRef.current);
      }}
    >
      {/* Keyframes */}
      <style>{`
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        ${!reducedMotion ? `
        @keyframes orbPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.95); }
          50%       { opacity: 0.6; transform: scale(1.05); }
        }
        ` : ''}
      `}</style>

      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={() => handleClose(completedRef.current)}
        className="absolute top-8 right-8 font-mono text-[11px] tracking-[1.5px] uppercase px-[18px] py-2.5 rounded-full border border-[rgba(251,249,242,0.2)] text-[rgba(251,249,242,0.55)] transition-all duration-200 hover:text-[#FBF9F2] hover:border-[#FBF9F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(251,249,242,0.5)]"
        aria-label="Close breathing modal"
      >
        CLOSE
      </button>

      {/* Main content region */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bm-protocol-title"
        className="text-center max-w-[520px] w-full px-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Active protocol view */}
        {!isComplete && (
          <>
            {/* Eyebrow */}
            <div
              id="bm-protocol-title"
              className="font-mono text-[11px] tracking-[2px] text-[#C0DD97] mb-4"
            >
              {protocolLabel} · {totalRounds} ROUNDS
            </div>

            {/* Instruction */}
            <div
              className="font-serif text-[36px] leading-[1.15] font-medium tracking-[-0.6px] text-[#FBF9F2] mb-14 min-h-[50px] transition-opacity duration-400"
              style={{ opacity: instructionOpacity }}
              aria-live="polite"
              aria-atomic="true"
            >
              {instruction}
            </div>

            {/* Orb */}
            <div className="relative w-[280px] h-[280px] mx-auto mb-12">
              {/* Glow ring */}
              {!reducedMotion && (
                <div
                  className="absolute inset-[-20%] rounded-full border border-[rgba(192,221,151,0.2)]"
                  style={{ animation: 'orbPulse 5s ease-in-out infinite' }}
                  aria-hidden="true"
                />
              )}

              {/* Orb */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, #7FB13C, #3B6D11)',
                  boxShadow: reducedMotion
                    ? undefined
                    : '0 0 80px rgba(127,177,60,0.4), 0 0 160px rgba(127,177,60,0.2), inset 0 0 40px rgba(255,255,255,0.15)',
                  ...orbStyle,
                }}
                aria-hidden="true"
              />
            </div>

            {/* Progress dots */}
            <div
              className="flex gap-2 justify-center mb-6"
              role="progressbar"
              aria-valuenow={completedRounds}
              aria-valuemax={totalRounds}
              aria-label={`Round ${currentRound + 1} of ${totalRounds}`}
            >
              {Array.from({ length: totalRounds }).map((_, i) => (
                <div
                  key={i}
                  className="w-7 h-1 rounded-full transition-[background] duration-400"
                  style={{
                    background:
                      i < completedRounds
                        ? '#97C459'
                        : i === currentRound
                        ? '#FBF9F2'
                        : 'rgba(251,249,242,0.18)',
                    animation: reducedMotion
                      ? undefined
                      : i === currentRound
                      ? undefined
                      : undefined,
                  }}
                  aria-hidden="true"
                />
              ))}
            </div>

            {/* Meta */}
            <div className="font-mono text-[11px] tracking-[1.5px] text-[rgba(251,249,242,0.55)] uppercase">
              Round {currentRound + 1} of {totalRounds}
            </div>
          </>
        )}

        {/* Completion screen */}
        {isComplete && (
          <div
            className="text-center"
            style={{ animation: 'cardEnter 0.6s ease' }}
          >
            <div className="w-20 h-20 border border-[#C0DD97] rounded-full flex items-center justify-center mx-auto mb-6 text-[#C0DD97] text-[36px]">
              &#x2713;
            </div>

            <div className="font-serif text-[36px] leading-[1.15] font-medium tracking-[-0.6px] text-[#FBF9F2] mb-8">
              You're back in{' '}
              <em className="italic" style={{ color: '#C0DD97' }}>the window.</em>
            </div>

            <p className="text-[rgba(251,249,242,0.7)] text-[16px] leading-[1.6] max-w-[400px] mx-auto mb-8">
              Breath stabilized. Cardiac micro-motion easing. The sensor will keep watching quietly.
            </p>

            <button
              ref={returnButtonRef}
              onClick={() => handleClose(true)}
              className="font-mono text-[11px] tracking-[1.5px] uppercase px-[18px] py-2.5 rounded-full border border-[rgba(251,249,242,0.2)] text-[rgba(251,249,242,0.55)] transition-all duration-200 hover:text-[#FBF9F2] hover:border-[#FBF9F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(251,249,242,0.5)]"
              aria-label="Return to today's dashboard"
            >
              RETURN TO TODAY
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, modalRoot);
}

export default BreathingModal;
