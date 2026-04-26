// Dashboard — the main-thread orchestrator wiring sensing, the trigger
// worker, and the Intervention surfaces together.
//
// Architecture (per docs/02_research/05_canonical_build_plan.md §6):
//   - WebSocket client streams VitalsFrames into the worker.
//   - Worker emits state_transition / trigger events back.
//   - On a `trigger` of type `morning_check`, render MorningCheckCard.
//     On any other event, render AffirmationCard.
//   - BreathGuide is paced by the latest `breathBpm` and the current state's
//     canonical pattern (Intervention DDD invariant 7).
//
// Memory wiring (Sprint C track 1):
//   - SessionStore is instantiated once via createSessionStore().
//   - On mount and after every state_transition we run morningCheckQuery
//     and post a `memory_snapshot` to the worker so the morning_check
//     detector sees yesterday's transitions.
//   - Every state_transition is persisted via appendTransition, and the
//     paired Intervention is persisted via appendIntervention.
//   - Feedback taps on AffirmationCard call appendFeedback.
//   - The recency window (recentAffirmationIds) is refreshed from IDB
//     after every appendIntervention so pickAffirmation honours invariant 2
//     across reloads.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createWsClient } from '../services/wsClient';
import { createSessionStore } from '../services/sessionStore';
import { createMorningCheckQuery } from '../services/morningCheckQuery';
import { createCloudSync } from '../services/cloudSync';
import { pickAffirmation } from '../services/affirmationFilter';
import affirmationsCorpus from '../data/affirmations.placeholder.json';
import type { Affirmation, Intervention } from '../types/intervention';
import type {
  MorningCheckPayload,
  State,
  StateTransition,
  TriggerEvent,
} from '../types/state';
import type { VitalsFrame } from '../types/vitals';
import AffirmationCard from '../components/intervention/AffirmationCard';
import BreathGuide from '../components/intervention/BreathGuide';
import StateBadge from '../components/dashboard/StateBadge';
import MorningCheckCard from '../components/dashboard/MorningCheckCard';
import TrustedWitnessButton from '../components/dashboard/TrustedWitnessButton';

const CORPUS = affirmationsCorpus as Affirmation[];
const RECENT_WINDOW = 5;
const SPARKLINE_WINDOW_MS = 60_000;
const MORNING_WINDOW_MS = 24 * 3600_000;

interface ActiveSurface {
  intervention: Intervention;
  affirmation: Affirmation;
  morningPayload?: MorningCheckPayload;
}

interface VitalSample {
  ts: number;
  breathBpm: number;
}

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') === 'recorded' ? 'recorded' : 'live';

  const [state, setState] = useState<State>('regulated');
  const [latestBreath, setLatestBreath] = useState<number | undefined>(undefined);
  const [breathSamples, setBreathSamples] = useState<VitalSample[]>([]);
  const [active, setActive] = useState<ActiveSurface | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  // Tick once per second so the sparkline's right edge tracks the wall clock
  // without having to call Date.now() during render (lint rule
  // react-hooks/purity forbids that).
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Refs so the worker callback closure never sees a stale recentIds list.
  // We update via an effect (not during render) per react-hooks/refs.
  const recentIdsRef = useRef<string[]>([]);
  useEffect(() => {
    recentIdsRef.current = recentIds;
  }, [recentIds]);

  const workerRef = useRef<Worker | null>(null);

  // SessionStore — IDB-backed MemoryAPI. Stable across the component's
  // lifetime; the underlying IDB connection is opened lazily on first call.
  const store = useMemo(() => createSessionStore(), []);
  // Sprint D: write-only Supabase mirror. Fail-soft: if env vars are missing
  // every insert collapses to a no-op and `isEnabled()` returns false.
  const cloudSync = useMemo(() => createCloudSync(), []);
  const morningCheckQuery = useMemo(
    () => createMorningCheckQuery(store, cloudSync),
    [store, cloudSync],
  );
  const cloudEnabled = cloudSync.isEnabled();

  /** Re-read yesterday's transitions and push them into the worker. */
  const refreshSnapshot = useCallback(async () => {
    const rows = await morningCheckQuery(MORNING_WINDOW_MS);
    workerRef.current?.postMessage({
      kind: 'memory_snapshot',
      snap: { rows },
    });
  }, [morningCheckQuery]);

  /** Re-read the recency window from IDB. */
  const refreshRecent = useCallback(async () => {
    const ids = await store.recentAffirmationIds();
    // store returns most-recent-first; pickAffirmation expects oldest-first.
    setRecentIds(ids.slice(0, RECENT_WINDOW).reverse());
  }, [store]);

  /** Pick a fresh affirmation for the given state and update active surface. */
  const surface = useCallback(
    (
      forState: State,
      transitionId: string,
      morningPayload?: MorningCheckPayload,
    ) => {
      const intervention = pickAffirmation({
        corpus: CORPUS,
        state: forState,
        transitionId,
        recentIds: recentIdsRef.current,
        ts: Date.now(),
      });
      const affirmation = CORPUS.find((a) => a.id === intervention.affirmationId);
      if (!affirmation) return;
      setActive({ intervention, affirmation, morningPayload });
      // Persist the intervention, then refresh the recency window so the
      // next pick sees this id in `recentIds`.
      void store
        .appendIntervention(intervention)
        .then(() => refreshRecent())
        .catch(() => {
          /* IDB never fails the caller (Memory DDD invariant) */
        });
      // Fire-and-forget cloud mirror (Memory DDD invariant 6: IDB is truth).
      void cloudSync.insertIntervention(intervention);
    },
    [refreshRecent, store, cloudSync],
  );

  // Spin up the worker + WebSocket on mount.
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/triggerWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    // Push the initial snapshot + recency window so the morning_check
    // detector and pickAffirmation both have real data on first frame.
    // Defer to a microtask so the setState inside `refreshRecent`
    // doesn't fire synchronously within the effect body
    // (react-hooks/set-state-in-effect).
    const initId = setTimeout(() => {
      void refreshSnapshot();
      void refreshRecent();
    }, 0);

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { kind: 'state_transition'; transition: StateTransition }
        | { kind: 'trigger'; event: TriggerEvent };
      if (msg.kind === 'state_transition') {
        const t = msg.transition;
        setState(t.to);
        // Persist first, then surface, then refresh the snapshot so the next
        // morning-check pass sees the new transition.
        void store
          .appendTransition(t)
          .then(() => refreshSnapshot())
          .catch(() => {});
        // Fire-and-forget cloud mirror (Memory DDD invariant 6).
        void cloudSync.insertTransition(t);
        surface(t.to, t.id);
      } else if (msg.kind === 'trigger') {
        const ev = msg.event;
        if (ev.type === 'morning_check' && ev.morningPayload) {
          surface('regulated', ev.transitionId, ev.morningPayload);
        } else {
          surface(state, ev.transitionId);
        }
      }
    };

    const ws = createWsClient();
    const unsub = ws.subscribe((frame: VitalsFrame) => {
      if (typeof frame.breathBpm === 'number') {
        setLatestBreath(frame.breathBpm);
        setBreathSamples((prev) => {
          const cutoff = frame.ts - SPARKLINE_WINDOW_MS;
          const next = [...prev, { ts: frame.ts, breathBpm: frame.breathBpm! }];
          return next.filter((s) => s.ts >= cutoff);
        });
      }
      worker.postMessage({ kind: 'vitals', frame });
    });
    ws.start({ source });

    // Sparkline wall-clock tick (once per second).
    const tickId = setInterval(() => setNowTick(Date.now()), 1000);

    return () => {
      clearTimeout(initId);
      clearInterval(tickId);
      unsub();
      ws.stop();
      worker.terminate();
      workerRef.current = null;
    };
    // We deliberately do NOT depend on `state` or `surface` — those are
    // captured via refs / closures whose latest values we read from inside
    // the message handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, cloudSync]);

  const handleManual = useCallback(() => {
    workerRef.current?.postMessage({ kind: 'manual_trigger' });
  }, []);

  const handleFeedback = useCallback(
    (signal: 'helped' | 'neutral' | 'unhelpful') => {
      const id = active?.intervention.transitionId;
      if (!id) return;
      workerRef.current?.postMessage({ kind: 'feedback', transitionId: id, signal });
      void store.appendFeedback({ transitionId: id, signal }).catch(() => {});
    },
    [active?.intervention.transitionId, store],
  );

  const breathPattern = useMemo(() => {
    if (active) return active.intervention.breathPattern;
    if (state === 'activated') return 'cyclic_sigh';
    if (state === 'recovering') return 'extended_exhale';
    return 'natural';
  }, [active, state]);

  return (
    <main className="min-h-screen bg-surface-900 text-slate-100 overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl tracking-tight">MindRefreshStudio</h1>
            <StateBadge state={state} />
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${
                cloudEnabled
                  ? 'border-emerald-700/60 text-emerald-300/90'
                  : 'border-slate-700/60 text-slate-500'
              }`}
              title={
                cloudEnabled
                  ? 'State events sync to Supabase'
                  : 'Local-only — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync'
              }
            >
              {cloudEnabled ? 'Sync: ON' : 'Sync: OFF (local-only)'}
            </span>
            <button
              type="button"
              onClick={handleManual}
              className="text-xs uppercase tracking-widest text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-full border border-slate-700"
            >
              I need a moment
            </button>
          </div>
        </header>

        <section className="grid gap-8 md:grid-cols-[1fr_320px] items-start">
          <div className="space-y-6">
            {active?.morningPayload ? (
              <MorningCheckCard
                payload={active.morningPayload}
                affirmation={active.affirmation}
                onTalk={() => {
                  /* Stub — Dashboard will swap in a free-form text box. */
                }}
              />
            ) : active ? (
              <AffirmationCard affirmation={active.affirmation} onFeedback={handleFeedback} />
            ) : (
              <PlaceholderCard />
            )}
            <div className="flex justify-center">
              <TrustedWitnessButton />
            </div>
          </div>

          <aside className="space-y-6">
            <BreathGuide pattern={breathPattern} breathBpm={latestBreath} />
            <BreathSparkline samples={breathSamples} latestTs={nowTick} />
          </aside>
        </section>

        <footer className="pt-6 text-xs text-slate-500 text-center max-w-2xl mx-auto">
          Raw biometric signals never leave your device. Only state events
          sync, to enable the morning check across devices.
        </footer>
      </div>
    </main>
  );
}

function PlaceholderCard() {
  return (
    <div className="max-w-2xl mx-auto px-8 py-10 bg-surface-800/60 rounded-2xl border border-slate-700/40 text-center text-slate-400">
      Listening to your breath. The first surface will appear when something
      shifts.
    </div>
  );
}

interface BreathSparklineProps {
  samples: VitalSample[];
  latestTs: number;
}

function BreathSparkline({ samples, latestTs }: BreathSparklineProps) {
  if (samples.length < 2) {
    return (
      <div className="text-xs text-slate-500 text-center">
        Waiting for breath data…
      </div>
    );
  }
  const width = 280;
  const height = 60;
  const startTs = latestTs - SPARKLINE_WINDOW_MS;
  const span = SPARKLINE_WINDOW_MS;
  const minBpm = Math.min(...samples.map((s) => s.breathBpm), 6);
  const maxBpm = Math.max(...samples.map((s) => s.breathBpm), 20);
  const range = Math.max(1, maxBpm - minBpm);

  const points = samples
    .map((s) => {
      const x = ((s.ts - startTs) / span) * width;
      const y = height - ((s.breathBpm - minBpm) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <figure className="rounded-xl border border-slate-700/60 bg-surface-800/60 p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="60-second breath rate trace"
      >
        <polyline
          points={points}
          fill="none"
          stroke="rgb(34 211 238)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <figcaption className="text-[10px] text-slate-500 mt-1 tracking-widest uppercase">
        Breath · last 60 s
      </figcaption>
    </figure>
  );
}
