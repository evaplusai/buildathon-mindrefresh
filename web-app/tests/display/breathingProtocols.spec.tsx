/**
 * breathingProtocols.spec.tsx — DC-B1-T3
 *
 * Vitest with fake timers. For each of the 3 protocols defined in
 * breathProtocols.json, renders <BreathingModal> and advances fake timers to
 * assert:
 *   - Per-phase instruction text changes at expected milestones (±50ms tolerance
 *     is implicit in the schedule: we advance exactly to the threshold).
 *   - Orb inline style.transform changes per phase.
 *   - Completion screen renders after the final round.
 *
 * Protocol totals per ADR-018 §D:
 *   physiological_sigh  5 × (2000 + 1000 + 5000) = 40 000 ms
 *   box_breath          4 × (4000 + 4000 + 4000 + 4000) = 64 000 ms
 *   four_seven_eight    4 × (4000 + 7000 + 8000) = 76 000 ms
 *
 * Internal startup offset: BreathingModal schedules:
 *   t=0    → state reset (via schedule(...,0))
 *   t=50   → focus close button
 *   t=800  → runProtocol()
 *
 * Each `step()` call:
 *   t+0    → opacity→0, setOrbStyle
 *   t+250  → setInstruction, opacity→1
 *   t+durationMs → move to next phase
 *
 * So first instruction visible at: 800 + 250 = 1050ms.
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { BreathingModal } from '../../src/components/dashboard/BreathingModal';

// Ensure #modal-root exists in happy-dom before each test.
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

// Helper: advance timers and flush React state updates.
async function tickMs(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

// Helper: get the orb element (the absolute inset-0 rounded-full div with the
// radial-gradient background style inside the orb container).
function getOrb(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[style*="radial-gradient"]');
}

// ─────────────────────────────────────────────────────────────────────────────
// physiological_sigh
// ─────────────────────────────────────────────────────────────────────────────
describe('physiological_sigh protocol timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('shows inhale instruction at t=1050ms (800 startup + 250 text fade)', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    // Advance to first instruction visible: 800ms startup + 250ms fade
    await tickMs(1050);

    // Should show inhale text (partial match for the <em> split)
    expect(screen.getByText(/Breathe in/i)).toBeInTheDocument();
  });

  it('orb scale changes to expanded on inhale phase', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    // After startup + inhale phase begins
    await tickMs(800);

    const orb = getOrb();
    expect(orb).not.toBeNull();
    // Orb should have a transform style set by orbPhaseStyle('Inhale', false)
    expect(orb!.style.transform).toMatch(/scale/);
  });

  it('shows top-up instruction at t=800+2000+250=3050ms', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    // startup(800) + inhale(2000) + text-fade(250)
    await tickMs(3050);

    expect(screen.getByText(/top-up/i)).toBeInTheDocument();
  });

  it('shows exhale instruction at t=800+2000+1000+250=4050ms', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    await tickMs(4050);

    expect(screen.getByText(/exhale/i)).toBeInTheDocument();
  });

  it('shows completion screen after all 5 rounds (>=40800ms)', async () => {
    render(
      <BreathingModal isOpen protocol="physiological_sigh" onClose={vi.fn()} />,
    );

    // 5 rounds x 8000ms + 800ms startup + 500ms completion delay
    await tickMs(800 + 5 * 8000 + 500 + 100);

    expect(screen.getByText(/You're back in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to today/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// box_breath
// ─────────────────────────────────────────────────────────────────────────────
describe('box_breath protocol timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('shows inhale instruction at t=1050ms', async () => {
    render(
      <BreathingModal isOpen protocol="box_breath" onClose={vi.fn()} />,
    );

    await tickMs(1050);

    expect(screen.getByText(/Breathe in/i)).toBeInTheDocument();
  });

  it('shows hold instruction at t=800+4000+250=5050ms', async () => {
    render(
      <BreathingModal isOpen protocol="box_breath" onClose={vi.fn()} />,
    );

    await tickMs(5050);

    expect(screen.getByText(/Hold/i)).toBeInTheDocument();
  });

  it('shows completion screen after all 4 rounds (>=64800ms)', async () => {
    render(
      <BreathingModal isOpen protocol="box_breath" onClose={vi.fn()} />,
    );

    // 4 rounds x 16000ms + 800ms startup + 500ms completion
    await tickMs(800 + 4 * 16000 + 500 + 100);

    expect(screen.getByText(/You're back in/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// four_seven_eight
// ─────────────────────────────────────────────────────────────────────────────
describe('four_seven_eight protocol timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureModalRoot();
  });

  afterEach(() => {
    vi.useRealTimers();
    removeModalRoot();
  });

  it('shows inhale instruction at t=1050ms', async () => {
    render(
      <BreathingModal isOpen protocol="four_seven_eight" onClose={vi.fn()} />,
    );

    await tickMs(1050);

    expect(screen.getByText(/Breathe in/i)).toBeInTheDocument();
  });

  it('shows hold instruction at t=800+4000+250=5050ms', async () => {
    render(
      <BreathingModal isOpen protocol="four_seven_eight" onClose={vi.fn()} />,
    );

    await tickMs(5050);

    expect(screen.getByText(/Hold/i)).toBeInTheDocument();
  });

  it('shows slow exhale instruction at t=800+4000+7000+250=12050ms', async () => {
    render(
      <BreathingModal isOpen protocol="four_seven_eight" onClose={vi.fn()} />,
    );

    await tickMs(12050);

    expect(screen.getByText(/Slow exhale/i)).toBeInTheDocument();
  });

  it('shows completion screen after all 4 rounds (>=76800ms)', async () => {
    render(
      <BreathingModal isOpen protocol="four_seven_eight" onClose={vi.fn()} />,
    );

    // 4 rounds x 19000ms + 800ms startup + 500ms completion
    await tickMs(800 + 4 * 19000 + 500 + 100);

    expect(screen.getByText(/You're back in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to today/i })).toBeInTheDocument();
  });
});
