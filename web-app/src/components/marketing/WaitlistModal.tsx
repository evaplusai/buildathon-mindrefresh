// WaitlistModal — email-capture modal, opens from the body waitlist CTAs.
//
// Per ADR-019 §C. Rendered via createPortal into the same `#modal-root`
// mount used by BreathingModal (ADR-018) so a11y (role, focus trap, ESC)
// is consistent across modals.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  isPlausibleEmail,
  submitWaitlistEmail,
  type WaitlistSource,
} from '../../services/waitlist';

export interface WaitlistModalProps {
  isOpen: boolean;
  source: WaitlistSource;
  onClose: () => void;
}

type Phase = 'idle' | 'submitting' | 'success' | 'error';

const SUCCESS_AUTOCLOSE_MS = 2000;

export default function WaitlistModal({ isOpen, source, onClose }: WaitlistModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const reset = useCallback(() => {
    setEmail('');
    setPhase('idle');
    setErrorMsg('');
  }, []);

  // Open / close lifecycle
  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    // Defer state reset to a microtask (react-hooks/set-state-in-effect)
    const t = setTimeout(() => {
      reset();
      inputRef.current?.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      openerRef.current?.focus();
    };
  }, [isOpen, reset]);

  // ESC + focus trap
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const candidates: Array<HTMLElement | null> = [
          inputRef.current,
          submitButtonRef.current,
          closeButtonRef.current,
        ];
        const focusable = candidates.filter(
          (el): el is HTMLElement => el !== null,
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const valid = isPlausibleEmail(email);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!valid || phase === 'submitting') return;
      setPhase('submitting');
      setErrorMsg('');
      const result = await submitWaitlistEmail(email, source);
      if (result.ok) {
        setPhase('success');
        const t = setTimeout(() => {
          onClose();
        }, SUCCESS_AUTOCLOSE_MS);
        return () => clearTimeout(t);
      } else {
        setPhase('error');
        setErrorMsg(result.error ?? 'Something went wrong. Try again.');
      }
    },
    [email, valid, phase, source, onClose],
  );

  if (!isOpen) return null;

  const modalRoot =
    typeof document !== 'undefined' ? document.getElementById('modal-root') : null;
  if (!modalRoot) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-marketing-ink/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[18px] bg-marketing-warmWhite border border-marketing-line shadow-[0_30px_60px_-25px_rgba(23,52,4,0.4)] p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-[11px] tracking-[2px] uppercase text-marketing-green-700 font-semibold">
            Early access
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-marketing-inkMuted hover:text-marketing-green-900 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <h2
          id={titleId}
          className="font-serif text-[26px] leading-[1.2] tracking-[-0.4px] text-marketing-green-900 font-medium mb-3"
        >
          Reserve your <em className="italic text-marketing-green-600">spot</em>.
        </h2>

        <p className="text-[14px] text-marketing-inkSoft leading-[1.55] mb-5">
          Drop your email and we'll reach out the moment your unit is ready
          to ship.
        </p>

        {phase === 'success' ? (
          <div
            role="status"
            aria-live="polite"
            className="bg-marketing-green-50 border border-marketing-green-200 rounded-[12px] p-4"
          >
            <p className="font-serif text-[16px] text-marketing-green-900 leading-[1.4]">
              Got it.{' '}
              <em className="italic text-marketing-green-600">
                We'll be in touch.
              </em>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label
              htmlFor="waitlist-email"
              className="font-mono text-[10px] tracking-[1.5px] uppercase text-marketing-inkMuted"
            >
              Email
            </label>
            <input
              ref={inputRef}
              id="waitlist-email"
              type="email"
              required
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-marketing-cream border border-marketing-line rounded-[10px] px-4 py-3 text-[15px] text-marketing-ink focus:outline-none focus:border-marketing-green-600"
              disabled={phase === 'submitting'}
            />
            {phase === 'error' ? (
              <p className="text-[13px] text-marketing-rose">{errorMsg}</p>
            ) : null}
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-[13px] text-marketing-inkSoft hover:text-marketing-green-900 px-4 py-2 rounded-full border border-marketing-line"
              >
                Cancel
              </button>
              <button
                ref={submitButtonRef}
                type="submit"
                disabled={!valid || phase === 'submitting'}
                className="bg-marketing-green-800 text-marketing-cream px-5 py-2 rounded-full text-[13px] font-semibold hover:bg-marketing-green-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {phase === 'submitting' ? 'Saving…' : 'Reserve my spot →'}
              </button>
            </div>
            <p className="text-[11px] text-marketing-inkMuted mt-1">
              We'll only use your email to notify you about early access.
            </p>
          </form>
        )}
      </div>
    </div>,
    modalRoot,
  );
}
