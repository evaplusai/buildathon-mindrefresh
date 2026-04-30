/**
 * SignalsPanel — dark-green card showing 4 live biometric signal bars.
 *
 * Per design HTML lines 209–258, 820–845, and ADR-017 §"Live Signals panel".
 *
 * On mount:
 *   1. Creates a wsClient subscription.
 *   2. Pushes each VitalsFrame into the shared vitalsRingBuffer.
 *   3. Calls deriveSignals() on each frame.
 *   4. Updates local state → React re-renders the bars.
 *
 * If presence=false (room empty) or deriveSignals returns null:
 *   - All bars render "—"
 *   - "Sensor idle · room empty" pill replaces the live header.
 *
 * Bar widths animate via Tailwind transition-[width].
 */

import { useEffect, useState, useRef } from 'react';
import { createWsClient } from '../../services/wsClient';
import { VitalsRingBuffer } from '../../services/vitalsRingBuffer';
import { deriveSignals } from '../../services/signals/derive';
import type { SignalsFrame } from '../../types/display';
import type { DashboardState } from '../../types/display';
import type { VitalsFrame } from '../../types/vitals';

export interface SignalsPanelProps {
  dashboardState: DashboardState;
  /** Override the wsClient with a mock for testing / demo mode. */
  wsClient?: ReturnType<typeof createWsClient>;
  /** Pre-seeded ring buffer (demo mode / recorded source). */
  ringBuffer?: VitalsRingBuffer;
  source?: 'live' | 'recorded';
}

const BAR_FILL_CLASS: Record<DashboardState, string> = {
  steady:     'bg-[#97C459]',
  shifting:   'bg-[#C99B4F]',
  overloaded: 'bg-[#C97A6B]',
  drained:    'bg-[#6B7558]',
};

interface DisplaySignal {
  label: string;
  sub: string;
  widthPct: number;
  value: string;
}

function toDisplaySignals(frame: SignalsFrame | null): DisplaySignal[] {
  if (!frame) {
    return [
      { label: 'Breath rate',         sub: 'leading signal',                  widthPct: 0, value: '—' },
      { label: 'Cardiac micro-motion',sub: 'contactless ballistocardiogram',   widthPct: 0, value: '—' },
      { label: 'Postural stillness',  sub: 'freeze indicator',                 widthPct: 0, value: '—' },
      { label: 'Movement cadence',    sub: 'activity rhythm',                  widthPct: 0, value: '—' },
    ];
  }

  const breathPct = Math.min(100, Math.max(0, ((frame.breathBpm - 6) / (30 - 6)) * 100));

  return [
    {
      label: 'Breath rate',
      sub: 'leading signal',
      widthPct: breathPct,
      value: `${Math.round(frame.breathBpm)} brpm`,
    },
    {
      label: 'Cardiac micro-motion',
      sub: 'contactless ballistocardiogram',
      widthPct: frame.cardiacMicroMotion * 100,
      value: `${Math.round(frame.cardiacMicroMotion * 100)}%`,
    },
    {
      label: 'Postural stillness',
      sub: 'freeze indicator',
      widthPct: frame.posturalStillness * 100,
      value: frame.posturalStillness > 0.8 ? 'Frozen' : frame.posturalStillness > 0.5 ? 'High' : frame.posturalStillness > 0.2 ? 'Low' : 'Moving',
    },
    {
      label: 'Movement cadence',
      sub: 'activity rhythm',
      widthPct: frame.movementCadence * 100,
      value: frame.movementCadence > 0.7 ? 'Active' : frame.movementCadence > 0.4 ? 'Even' : frame.movementCadence > 0.1 ? 'Stalled' : 'Slow',
    },
  ];
}

export function SignalsPanel({
  dashboardState,
  wsClient: wsClientProp,
  ringBuffer: ringBufferProp,
  source = 'live',
}: SignalsPanelProps) {
  const [signals, setSignals] = useState<SignalsFrame | null>(null);
  const [isIdle, setIsIdle] = useState(false);

  // Stable refs so the useEffect closure doesn't go stale
  const bufferRef = useRef<VitalsRingBuffer>(ringBufferProp ?? new VitalsRingBuffer());
  const clientRef = useRef(wsClientProp ?? createWsClient());

  useEffect(() => {
    const client = clientRef.current;
    const buffer = bufferRef.current;

    const unsubscribe = client.subscribe((frame: VitalsFrame) => {
      buffer.push(frame);

      if (!frame.presence) {
        setIsIdle(true);
        setSignals(null);
        return;
      }

      const derived = deriveSignals(buffer, frame.source);
      if (!derived) {
        setIsIdle(true);
        setSignals(null);
      } else {
        setIsIdle(false);
        setSignals(derived);
      }
    });

    client.start({ source });

    return () => {
      unsubscribe();
      client.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const displaySignals = toDisplaySignals(signals);
  const fillClass = BAR_FILL_CLASS[dashboardState];

  return (
    <div
      className={[
        'relative overflow-hidden',
        'bg-marketing-green-900 text-[#EAF3DE]',
        'rounded-[22px] px-8 py-7',
        'flex flex-col gap-[18px]',
      ].join(' ')}
      role="region"
      aria-label="Live biometric signals"
    >
      {/* Radial highlight */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 100% 0%, rgba(192,221,151,0.08), transparent 50%)',
        }}
      />

      {/* Header */}
      <div className="flex justify-between items-center relative z-[1]">
        <div className="font-mono text-[10px] tracking-[1.8px] text-[rgba(234,243,222,0.55)] uppercase font-semibold">
          Live signals
        </div>

        {isIdle ? (
          <div
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[1px] text-marketing-green-100 font-semibold"
            role="status"
            aria-live="polite"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#6B7558]"
              aria-hidden="true"
            />
            Sensor idle · room empty
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[1px] text-marketing-green-100 font-semibold">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#97C459] animate-pulse"
              aria-hidden="true"
            />
            4Hz · LOCAL
          </div>
        )}
      </div>

      {/* Signal rows */}
      {displaySignals.map((sig, i) => (
        <div
          key={sig.label}
          className={[
            'grid gap-4 items-center relative z-[1]',
            'py-3',
            i < displaySignals.length - 1 ? 'border-b border-b-[rgba(234,243,222,0.1)]' : '',
          ].join(' ')}
          style={{ gridTemplateColumns: '110px 1fr auto' }}
        >
          <div>
            <div className="font-serif text-[14px] text-marketing-cream font-medium">
              {sig.label}
            </div>
            <div className="block font-mono text-[9px] tracking-[0.8px] text-[rgba(234,243,222,0.5)] uppercase mt-0.5">
              {sig.sub}
            </div>
          </div>

          <div
            className="h-[6px] bg-[rgba(234,243,222,0.1)] rounded-[3px] overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(sig.widthPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={sig.label}
          >
            <div
              className={`h-full rounded-[3px] ${fillClass} transition-[width] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]`}
              style={{ width: `${sig.widthPct}%` }}
            />
          </div>

          <div className="font-mono text-[13px] text-marketing-green-100 font-semibold min-w-[50px] text-right transition-colors duration-[600ms]">
            {sig.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default SignalsPanel;
