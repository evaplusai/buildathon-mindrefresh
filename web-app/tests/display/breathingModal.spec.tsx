/**
 * breathingModal.spec.tsx — DC-B1-T4
 *
 * ADR-018 §B test contract. Tests the BreathingModal's accessibility and
 * interaction invariants:
 *   - Portal mount into #modal-root (NOT inside the parent React tree)
 *   - ARIA: role="dialog", aria-modal="true", aria-labelledby points at title
 *   - Focus moves to close button on open
 *   - ESC calls onClose(false) [not completed]
 *   - Backdrop click calls onClose(false)
 *   - Focus returns to the element focused before open
 *   - prefers-reduced-motion: orb has no animation/transition style for transform
 *   - Tab focus trap: single focusable stays on close; post-completion has return button
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { BreathingModal } from '../../src/components/dashboard/BreathingModal';

function ensureModalRoot() {
  if (!document.getElementById('modal-root')) {
    const div = document.createElement('div');
    div.id = 'modal-root';
    document.body.appendChild(div);
  }
}

function removeModalRoot() {
  document.getElementById('modal-root')?.remove();
}

async function tickMs(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal mount
// ─────────────────────────────────────────────────────────────────────────────
describe('Portal mount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('renders inside #modal-root, NOT inside the React parent container', async () => {
    const { container } = render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    await tickMs(100);

    const modalRoot = document.getElementById('modal-root')!;
    // The dialog content should be in modal-root
    expect(modalRoot.querySelector('[role="dialog"]')).not.toBeNull();
    // The render container (parent) should NOT contain the dialog
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ARIA attributes
// ─────────────────────────────────────────────────────────────────────────────
describe('ARIA attributes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('has role="dialog" and aria-modal="true"', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    await tickMs(100);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('aria-labelledby references the protocol title element', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    await tickMs(100);

    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();

    const titleEl = document.getElementById(labelId!);
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toMatch(/PHYSIOLOGICAL SIGH/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Focus on open
// ─────────────────────────────────────────────────────────────────────────────
describe('Focus on open', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('moves focus to the close button when modal opens', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    // BreathingModal focuses close button at t=50ms
    await tickMs(100);

    const closeBtn = screen.getByRole('button', { name: /close breathing modal/i });
    expect(document.activeElement).toBe(closeBtn);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESC dismissal
// ─────────────────────────────────────────────────────────────────────────────
describe('ESC dismissal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('calls onClose(false) when ESC is pressed mid-protocol', async () => {
    const onClose = vi.fn();
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={onClose} />,
    );

    await tickMs(100);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backdrop dismissal
// ─────────────────────────────────────────────────────────────────────────────
describe('Backdrop dismissal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('calls onClose(false) when backdrop outer div is clicked', async () => {
    const onClose = vi.fn();
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={onClose} />,
    );

    await tickMs(100);

    // The backdrop is the outermost fixed-inset-0 div. It handles click when
    // e.target === e.currentTarget (clicking outside the dialog).
    const backdrop = document.querySelector<HTMLElement>('.fixed.inset-0');
    expect(backdrop).not.toBeNull();

    // Simulate a click directly on the backdrop element.
    // fireEvent.click sets target to the element itself, simulating a
    // direct click on the backdrop (not on a child).
    Object.defineProperty(backdrop!, 'currentTarget', {
      get: () => backdrop,
      configurable: true,
    });
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledWith(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Focus restoration
// ─────────────────────────────────────────────────────────────────────────────
describe('Focus restoration on close', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('restores focus to the element focused before open', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <div>
        <button id="opener">Begin reset</button>
        <BreathingModal isOpen={false} protocol="physiological_sigh" onClose={onClose} />
      </div>,
    );

    const openerBtn = document.getElementById('opener') as HTMLButtonElement;
    openerBtn.focus();
    expect(document.activeElement).toBe(openerBtn);

    // Open the modal — this is when BreathingModal captures document.activeElement
    rerender(
      <div>
        <button id="opener">Begin reset</button>
        <BreathingModal isOpen protocol="physiological_sigh" onClose={onClose} />
      </div>,
    );

    // Focus should move to close button after 50ms
    await tickMs(100);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /close breathing modal/i }),
    );

    // Press ESC to close — handleClose restores openerRef
    fireEvent.keyDown(document, { key: 'Escape' });

    // Focus should be restored to the element that was focused when modal opened
    expect(document.activeElement).toBe(openerBtn);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// prefers-reduced-motion
// ─────────────────────────────────────────────────────────────────────────────
describe('prefers-reduced-motion', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();

    // Mock matchMedia to return matches:true for reduced-motion query
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList);
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
    matchMediaSpy.mockRestore();
  });

  it('orb has no animation style when prefers-reduced-motion is true', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    // Advance to inhale phase so orb has a defined style
    await tickMs(800);

    const orb = document.querySelector<HTMLElement>('[style*="radial-gradient"]');
    expect(orb).not.toBeNull();

    // Per ADR-018 §B: reduced-motion removes animation from orb
    expect(orb!.style.animation).toBe('');
  });

  it('orb has no transition style for transform when prefers-reduced-motion is true', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    await tickMs(800);

    const orb = document.querySelector<HTMLElement>('[style*="radial-gradient"]');
    expect(orb).not.toBeNull();

    // In reduced-motion mode, orbPhaseStyle returns only transform, no transition property
    expect(orb!.style.transition).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab focus trap
// ─────────────────────────────────────────────────────────────────────────────
describe('Tab focus trap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('Tab on close button stays on close button (only one focusable element mid-protocol)', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    await tickMs(100);

    const closeBtn = screen.getByRole('button', { name: /close breathing modal/i });
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Fire Tab — should be prevented and focus stays on close button
    fireEvent.keyDown(document, { key: 'Tab' });

    // With only one focusable, focus stays on close button
    expect(document.activeElement).toBe(closeBtn);
  });

  it('after completion, RETURN TO TODAY button is in the DOM and focusable', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    // Advance to completion: 800ms startup + 5x8000ms rounds + 500ms completion delay
    await tickMs(800 + 5 * 8000 + 600);

    const returnBtn = screen.queryByRole('button', { name: /return to today/i });
    expect(returnBtn).not.toBeNull();
    expect(returnBtn).toBeInTheDocument();
  });
});
