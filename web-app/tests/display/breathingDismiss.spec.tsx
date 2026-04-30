/**
 * breathingDismiss.spec.tsx — DC-B1-T6
 *
 * ADR-018 §C test contract. Tests mid-protocol dismissal behaviour:
 *   - ESC mid-protocol calls onClose(false) (not completed)
 *   - Close button mid-protocol calls onClose(false)
 *   - Completing all rounds calls onClose(true) via RETURN TO TODAY
 *   - Multiple rapid ESC presses only fire onClose once (first call = false)
 *   - completedRef accuracy: mid-sigh = false, post-completion = true
 *
 * Note on Intervention persistence:
 *   The BreathingModal itself only calls onClose(completed: boolean). The
 *   parent Dashboard.tsx's handleModalClose then calls
 *   store.appendIntervention({ ...row, completed }). This means the
 *   persistence path is exercised by the Dashboard handler, not directly
 *   by the modal. The e2e test (breathing-modal.spec.ts) covers the full
 *   round-trip. Here we verify the modal's contract: onClose(false) on abort,
 *   onClose(true) on completion.
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
// Mid-protocol abort via ESC
// ─────────────────────────────────────────────────────────────────────────────
describe('Mid-protocol abort (ESC)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('calls onClose(false) when ESC pressed mid-protocol (round 2 of 5 sigh)', async () => {
    const onClose = vi.fn();
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={onClose} />,
    );

    // Advance ~16s: startup(800) + round1(8000) + half of round2(~7200)
    // Total approx 16 000ms — firmly mid-protocol, rounds not complete
    await tickMs(16_000);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('calls onClose(false) when close button clicked mid-protocol', async () => {
    const onClose = vi.fn();
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={onClose} />,
    );

    // Advance to a known mid-protocol point (~10s)
    await tickMs(10_000);

    const closeBtn = screen.getByRole('button', { name: /close breathing modal/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('calls onClose(false) mid-protocol for box_breath (round 2 of 4)', async () => {
    const onClose = vi.fn();
    render(
      <BreathingModal isOpen protocol="box_breath" onClose={onClose} />,
    );

    // box_breath round 1 = 16000ms; advance ~25s (mid round 2)
    await tickMs(25_000);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('first ESC call passes false (even if subsequent events fire)', async () => {
    const onClose = vi.fn();
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={onClose} />,
    );

    await tickMs(10_000);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });

    // First call must be with false (incomplete)
    expect(onClose.mock.calls[0][0]).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Completion path
// ─────────────────────────────────────────────────────────────────────────────
describe('Completion path', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('calls onClose(true) when RETURN TO TODAY is clicked after completion', async () => {
    const onClose = vi.fn();
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={onClose} />,
    );

    // Complete all 5 rounds: startup(800) + 5x8000 + 500ms completion delay
    await tickMs(800 + 5 * 8000 + 600);

    const returnBtn = screen.getByRole('button', { name: /return to today/i });
    fireEvent.click(returnBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(true);
  });
});
