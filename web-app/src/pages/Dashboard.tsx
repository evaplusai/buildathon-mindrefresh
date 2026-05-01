// Dashboard — V2 composition.
//
// V1 wiring preserved: WebSocket → triggerWorker → state transitions →
// IndexedDB persistence + Supabase cloud mirror + AffirmationCard /
// MorningCheckCard for sensor-triggered surfaces.
//
// V2 surface added per ADR-015 / ADR-017 / ADR-018:
//   - StateDial + SignalsPanel + ResetCard + BreathingModal
//   - Pattern Mirror + Today Strip aggregators (read sessionStore)
//   - Demo Mode (?demo=1) — bypasses wsClient/worker, drives a 44s arc
//   - Internal 3-state classifier mapped to 4-state UI via
//     `toDashboardState` (ADR-015) — worker is unchanged.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { createWsClient } from '../services/wsClient';
import { createSessionStore } from '../services/sessionStore';
import { createMorningCheckQuery } from '../services/morningCheckQuery';
import { createCloudSync } from '../services/cloudSync';
import { pickAffirmation } from '../services/affirmationFilter';
import affirmationsCorpus from '../data/affirmations.placeholder.json';

import { toDashboardState } from '../services/display/toDashboardState';
import { createDemoArcRunner, type DemoArcRunner } from '../services/demoMode';
import { resolveProtocol } from '../services/display/resolveProtocol';

import type { Affirmation, Intervention } from '../types/intervention';
import type {
  MorningCheckPayload,
  State,
  StateTransition,
  TriggerEvent,
} from '../types/state';
import type { VitalsFrame } from '../types/vitals';
import type { DashboardState, BreathProtocol } from '../types/display';

import MorningCheckCard from '../components/dashboard/MorningCheckCard';
import TrustedWitnessButton from '../components/dashboard/TrustedWitnessButton';

import StateDial from '../components/dashboard/StateDial';
import ResetCard from '../components/dashboard/ResetCard';
import BreathingModal from '../components/dashboard/BreathingModal';
import PatternMirror from '../components/dashboard/PatternMirror';
import TodayStrip from '../components/dashboard/TodayStrip';
import DemoModeToggle from '../components/dashboard/DemoModeToggle';
import AvatarPill from '../components/dashboard/AvatarPill';
import Logo from '../components/shared/Logo';
import ReflectCard from '../components/dashboard/ReflectCard';
import { logDisagreement } from '../services/display/disagreementLog';
import type { RecentReflectRun } from '../services/display/resolveProtocol';

const CORPUS = affirmationsCorpus as Affirmation[];
const RECENT_WINDOW = 5;
const MORNING_WINDOW_MS = 24 * 3600_000;

// State descriptions for the dial (per design HTML lines 1051–1083).
const STATE_DESC: Record<DashboardState, string> = {
  steady:
    'Balanced rhythm. Breath even, posture mobile, recovery tracking on time. The sensor is watching for the first sign of a shift.',
  shifting:
    "Breath rate climbing. Postural stillness rising. The sensor caught a transition you haven't felt yet — there's an 8-minute window before it crests.",
  overloaded:
    'Activation peaked. Breath shallow and rapid. This is the point most tools would notice — your sensor saw it eight minutes ago.',
  drained:
    'Activation crashed below baseline. Movement cadence slow, breath flat. This is the after — the system asking for a different kind of rest.',
};

const STATE_GREETING: Record<DashboardState, { textA: string; em: string; textB: string }> = {
  steady: { textA: 'Good afternoon. Your system is ', em: 'steady', textB: '.' },
  shifting: { textA: 'Your system is ', em: 'shifting', textB: '. Caught it early.' },
  overloaded: { textA: 'Your body is ', em: 'overloaded', textB: '.' },
  drained: { textA: 'Your system is ', em: 'drained', textB: '.' },
};

// Map V2 BreathProtocol → V1 breathPattern enum for persistence compatibility.
function protocolToBreathPattern(p: BreathProtocol): Intervention['breathPattern'] {
  switch (p) {
    case 'physiological_sigh':
      return 'cyclic_sigh';
    case 'box_breath':
      return 'natural';
    case 'four_seven_eight':
      return 'extended_exhale';
  }
}

interface ActiveSurface {
  intervention: Intervention;
  affirmation: Affirmation;
  morningPayload?: MorningCheckPayload;
}

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') === 'recorded' ? 'recorded' : 'live';
  const devMode = searchParams.get('dev') === '1';
  const demoUrl = searchParams.get('demo') === '1';

  const [internalState, setInternalState] = useState<State>('regulated');
  const [latestBreath, setLatestBreath] = useState<number | undefined>(undefined);
  const [active, setActive] = useState<ActiveSurface | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [whatsAliveOpen, setWhatsAliveOpen] = useState(false);
  const [whatsAliveText, setWhatsAliveText] = useState('');

  // Persistent morning-summary snapshot — always rendered on the dashboard
  // (no longer gated on the morning_check trigger firing).
  const [morningSnapshot, setMorningSnapshot] = useState<{
    payload: MorningCheckPayload;
    affirmation: Affirmation;
  } | null>(null);

  // V2 — display-state derivation inputs
  const [latestSeverity, setLatestSeverity] = useState(0);
  const [lastTransitionTs, setLastTransitionTs] = useState<number | undefined>(undefined);
  const [regulatedBaseline] = useState(12); // worker emits BaselineUpdate; default for V2 ship

  // V2 — demo + modal
  const [demoActive, setDemoActive] = useState(demoUrl);
  const [demoState, setDemoState] = useState<DashboardState>('steady');
  const [breathModalOpen, setBreathModalOpen] = useState(false);

  // Sprint B — most recent Reflect run protocol advisory (ADR-018 §A)
  const [recentReflectProtocol, setRecentReflectProtocol] = useState<RecentReflectRun | undefined>(undefined);

  // Wall-clock tick at 1 Hz so dwell-derived state recomputes without
  // calling Date.now() inside useMemo (react-hooks/purity rule).
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const recentIdsRef = useRef<string[]>([]);
  useEffect(() => {
    recentIdsRef.current = recentIds;
  }, [recentIds]);

  const workerRef = useRef<Worker | null>(null);
  const demoRunnerRef = useRef<DemoArcRunner>(createDemoArcRunner());

  const store = useMemo(() => createSessionStore(), []);
  const cloudSync = useMemo(() => createCloudSync(), []);
  const morningCheckQuery = useMemo(
    () => createMorningCheckQuery(store, cloudSync),
    [store, cloudSync],
  );
  const cloudEnabled = cloudSync.isEnabled();

  // Sensor-derived dashboardState — recompute whenever inputs change.
  const sensorDashboardState: DashboardState = useMemo(() => {
    const dwellMs = lastTransitionTs ? nowTick - lastTransitionTs : 0;
    return toDashboardState({
      state: internalState,
      severity: latestSeverity,
      dwellMs,
      breathBpm: latestBreath,
      regulatedBaseline,
    });
  }, [internalState, latestSeverity, lastTransitionTs, latestBreath, regulatedBaseline, nowTick]);

  // Effective state shown in the UI: demo arc wins when demoActive, else sensor.
  const dashboardState: DashboardState = demoActive ? demoState : sensorDashboardState;

  const refreshSnapshot = useCallback(async () => {
    const rows = await morningCheckQuery(MORNING_WINDOW_MS);
    workerRef.current?.postMessage({ kind: 'memory_snapshot', snap: { rows } });

    // Recompute the always-visible morning summary on every snapshot refresh.
    const yesterdayCount = rows.filter((r) => r.to_state === 'activated').length;
    const lastEventTs = rows.length > 0 ? rows[0].ts : 0;
    const todayBaseline = latestBreath ?? regulatedBaseline;
    const payload: MorningCheckPayload = {
      yesterdayCount,
      lastEventTs,
      todayBaseline,
      regulatedBaseline,
    };
    const affirmation =
      CORPUS.find((a) => a.state === 'regulated') ?? CORPUS[0];
    if (affirmation) {
      setMorningSnapshot({ payload, affirmation });
    }
  }, [morningCheckQuery, latestBreath, regulatedBaseline]);

  const refreshRecent = useCallback(async () => {
    const ids = await store.recentAffirmationIds();
    setRecentIds(ids.slice(0, RECENT_WINDOW).reverse());
  }, [store]);

  const surface = useCallback(
    (forState: State, transitionId: string, morningPayload?: MorningCheckPayload) => {
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
      void store
        .appendIntervention(intervention)
        .then(() => refreshRecent())
        .catch(() => {});
      void cloudSync.insertIntervention(intervention);
    },
    [refreshRecent, store, cloudSync],
  );

  // Worker + WebSocket — skipped entirely in demo mode.
  useEffect(() => {
    if (demoActive) return;

    const worker = new Worker(new URL('../workers/triggerWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

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
        setInternalState(t.to);
        setLastTransitionTs(t.ts);
        void store.appendTransition(t).then(() => refreshSnapshot()).catch(() => {});
        void cloudSync.insertTransition(t);
        surface(t.to, t.id);
      } else if (msg.kind === 'trigger') {
        const ev = msg.event;
        setLatestSeverity(ev.severity);
        if (ev.type === 'morning_check' && ev.morningPayload) {
          surface('regulated', ev.transitionId, ev.morningPayload);
        } else {
          surface(internalState, ev.transitionId);
        }
      }
    };

    const ws = createWsClient();
    const unsub = ws.subscribe((frame: VitalsFrame) => {
      if (typeof frame.breathBpm === 'number') {
        setLatestBreath(frame.breathBpm);
      }
      worker.postMessage({ kind: 'vitals', frame });
    });
    ws.start({ source });

    return () => {
      clearTimeout(initId);
      unsub();
      ws.stop();
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, cloudSync, demoActive]);

  // Always-visible morning summary — refresh on mount and whenever the
  // breath baseline updates. Runs in both live and demo modes so the
  // MorningCheckCard panel always has data to render.
  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  // Demo arc runner.
  useEffect(() => {
    const runner = demoRunnerRef.current;
    if (!demoActive) {
      runner.stop();
      return;
    }
    runner.start((s) => setDemoState(s));
    return () => runner.stop();
  }, [demoActive]);

  const handleManual = useCallback(() => {
    workerRef.current?.postMessage({ kind: 'manual_trigger' });
  }, []);

  const handleForceMorningCheck = useCallback(async () => {
    const rows = await morningCheckQuery(MORNING_WINDOW_MS);
    const yesterdayCount = rows.filter((r) => r.to_state === 'activated').length;
    const lastEventTs = rows.length > 0 ? rows[0].ts : Date.now() - 8 * 3600_000;
    const todayBaseline = latestBreath ?? 12;
    const synthetic: TriggerEvent = {
      type: 'morning_check',
      transitionId: globalThis.crypto.randomUUID(),
      severity: 0.4,
      ts: Date.now(),
      morningPayload: {
        yesterdayCount,
        lastEventTs,
        todayBaseline,
        regulatedBaseline,
      },
    };
    surface('regulated', synthetic.transitionId, synthetic.morningPayload);
  }, [morningCheckQuery, latestBreath, surface, regulatedBaseline]);

  const handleSubmitWhatsAlive = useCallback(async () => {
    const text = whatsAliveText.trim();
    const transitionId = active?.intervention.transitionId;
    if (!text || !transitionId) {
      setWhatsAliveOpen(false);
      return;
    }
    try {
      await store.appendWhatsAlive(text, transitionId);
    } catch {
      /* IDB never fails the caller */
    }
    setWhatsAliveText('');
    setWhatsAliveOpen(false);
  }, [whatsAliveText, active?.intervention.transitionId, store]);


  // V2 — modal protocol resolution. When a Reflect run completed within the
  // last 5 minutes, Agent 3's advisory takes precedence (ADR-018 §A).
  // nowTick drives the resolution pure (no Date.now in render).
  const modalProtocol: BreathProtocol = useMemo(() => {
    return resolveProtocol({ recentRun: recentReflectProtocol, dashboardState, now: nowTick });
  }, [recentReflectProtocol, dashboardState, nowTick]);

  const handleBeginReset = useCallback(() => {
    setBreathModalOpen(true);
  }, []);

  const handleModalClose = useCallback(
    async (completed: boolean) => {
      setBreathModalOpen(false);
      // Focus restoration handled by BreathingModal's openerRef (saved on open).
      // Log a fresh Intervention row for this breathing session.
      const transitionId = active?.intervention.transitionId ?? globalThis.crypto.randomUUID();
      const sessionRow: Intervention = {
        transitionId,
        affirmationId: `breath-${modalProtocol}`,
        breathPattern: protocolToBreathPattern(modalProtocol),
        ts: Date.now(),
      };
      try {
        await store.appendIntervention({ ...sessionRow, completed } as Intervention & { completed: boolean });
      } catch {
        /* never fail the caller */
      }
    },
    [active, modalProtocol, store],
  );

  // Greeting strings for the current display state.
  const greeting = STATE_GREETING[dashboardState];
  const stateDesc = STATE_DESC[dashboardState];
  const windowOpenMinutes =
    dashboardState === 'shifting' ? 8 : dashboardState === 'overloaded' ? 0 : undefined;

  return (
    <div className="min-h-screen bg-marketing-cream text-marketing-ink font-sans">
      {/* TOP NAV */}
      <nav className="py-[18px] border-b border-marketing-lineSoft bg-white/[0.94] backdrop-blur-[12px] sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto px-8 flex justify-between items-center gap-6">
          <div className="flex items-center gap-[10px] font-serif text-[22px] text-marketing-green-900 tracking-[-0.4px] font-medium">
            <Logo size={28} />
            MindRefresh
          </div>
          <div className="flex gap-1">
            <button className="text-sm text-marketing-green-900 font-medium px-4 py-2 rounded-full bg-marketing-green-50">
              Today
            </button>
            <button
              disabled
              title="Coming soon"
              className="text-sm text-marketing-inkSoft font-medium px-4 py-2 rounded-full opacity-60 cursor-not-allowed"
            >
              Patterns
            </button>
            <button
              disabled
              title="Coming soon"
              className="text-sm text-marketing-inkSoft font-medium px-4 py-2 rounded-full opacity-60 cursor-not-allowed"
            >
              History
            </button>
            <button
              disabled
              title="Coming soon"
              className="text-sm text-marketing-inkSoft font-medium px-4 py-2 rounded-full opacity-60 cursor-not-allowed"
            >
              Sensor
            </button>
          </div>
          <div className="flex items-center gap-[14px]">
            <DemoModeToggle active={demoActive} onToggle={() => setDemoActive((v) => !v)} />
            <AvatarPill initials="JL" />
          </div>
        </div>
      </nav>

      <main className="max-w-[1280px] mx-auto px-8">
        {/* HEADER */}
        <header className="pt-12 pb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] tracking-[2px] text-marketing-green-700 mb-3 uppercase">
            <span className="w-[7px] h-[7px] rounded-full bg-marketing-green-400 animate-pulse" />
            {demoActive
              ? 'Demo mode · scripted arc playing'
              : source === 'recorded'
                ? 'Recorded session · playback'
                : 'Sensor reading · living room'}
          </div>
          <div className="flex justify-between items-end gap-8 flex-wrap">
            <h1 className="font-serif text-[52px] leading-[1.05] tracking-[-1.4px] text-marketing-green-900 font-medium max-w-[800px]">
              {greeting.textA}
              <em className="italic text-marketing-green-600 font-medium">{greeting.em}</em>
              {greeting.textB}
            </h1>
            <div className="flex flex-col items-end gap-1 text-[13px] text-marketing-inkMuted font-mono tracking-[0.5px]">
              <span className="text-marketing-green-900 font-semibold text-sm">
                {new Date().toLocaleString('en-US', {
                  weekday: 'long',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span>Day 12 of observation</span>
            </div>
          </div>
        </header>

        {/* TWO-COLUMN GRID
            Left col:  StateDial (single cell)
            Right col: Reflect+Reset combined panel
            Today, so far is rendered full-width below the grid. */}
        <section className="grid grid-cols-1 lg:grid-cols-[3fr_7fr] gap-6 mb-6 items-stretch">
          <StateDial
            dashboardState={dashboardState}
            internalState={internalState}
            description={stateDesc}
            windowOpenMinutes={windowOpenMinutes}
          />
          <ReflectCard
            sensorState={sensorDashboardState}
            breathBpm={latestBreath}
            onAdvisory={(advised, sensor) => {
              void logDisagreement({
                ts: Date.now(),
                advised,
                sensor,
                runId: globalThis.crypto.randomUUID(),
              });
            }}
            onProtocolAdvisory={(protocol) =>
              setRecentReflectProtocol({ ts: Date.now(), protocol })
            }
            footer={
              <ResetCard
                dashboardState={dashboardState}
                onBeginReset={handleBeginReset}
                nested
              />
            }
          />
        </section>

        {/* Today, so far — full width below the grid */}
        <section className="mb-6">
          <TodayStrip store={store} />
        </section>

        {/* MORNING CHECK — always visible. Uses the live morning_check
            payload when one fires, otherwise falls back to the standalone
            morningSnapshot derived from the last 24h of transitions. */}
        {(active?.morningPayload || morningSnapshot) && (
          <section className="mb-6">
            <MorningCheckCard
              payload={active?.morningPayload ?? morningSnapshot!.payload}
              affirmation={
                active?.morningPayload
                  ? active.affirmation
                  : morningSnapshot!.affirmation
              }
              onTalk={() => setWhatsAliveOpen(true)}
            />
          </section>
        )}


        {/* PATTERN MIRROR */}
        <PatternMirror store={store} />

        {/* FOOTER + dev/manual buttons */}
        <footer className="py-8 text-xs text-marketing-inkMuted text-center max-w-2xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-marketing-inkMuted">
              {cloudEnabled ? 'Sync: ON' : 'Sync: OFF (local-only)'}
            </span>
            <button
              type="button"
              onClick={handleManual}
              className="text-xs uppercase tracking-widest text-marketing-inkSoft hover:text-marketing-green-900 px-3 py-1.5 rounded-full border border-marketing-line"
            >
              I need a moment
            </button>
            {devMode ? (
              <button
                type="button"
                onClick={handleForceMorningCheck}
                className="text-xs uppercase tracking-widest text-marketing-rose hover:text-marketing-green-900 px-3 py-1.5 rounded-full border border-marketing-line"
                title="Dev: force a morning_check trigger"
              >
                Force morning check
              </button>
            ) : null}
            <TrustedWitnessButton />
          </div>
          <span>🔒 Local processing · Raw signals never leave your sensor</span>
        </footer>
      </main>

      {/* BREATHING MODAL */}
      <BreathingModal
        isOpen={breathModalOpen}
        protocol={modalProtocol}
        onClose={handleModalClose}
      />

      {/* WHAT'S ALIVE MODAL — V1 surface preserved */}
      {whatsAliveOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="What's alive"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setWhatsAliveOpen(false)}
        >
          <div
            className="max-w-lg w-full rounded-2xl border border-marketing-line bg-marketing-warmWhite p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm uppercase tracking-widest text-marketing-green-700 font-mono">
              What's alive
            </h2>
            <p className="text-xs text-marketing-inkMuted">
              Stays on this device. Never synced. Never embedded.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={whatsAliveText}
              onChange={(e) => setWhatsAliveText(e.target.value)}
              placeholder="A sentence about what's here right now…"
              className="w-full rounded-lg bg-marketing-cream border border-marketing-line p-3 text-sm text-marketing-ink focus:outline-none focus:border-marketing-green-600"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWhatsAliveOpen(false)}
                className="text-xs uppercase tracking-widest text-marketing-inkSoft hover:text-marketing-green-900 px-3 py-1.5 rounded-full border border-marketing-line"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitWhatsAlive}
                disabled={!whatsAliveText.trim()}
                className="text-xs uppercase tracking-widest text-marketing-green-800 hover:text-marketing-green-900 px-3 py-1.5 rounded-full border border-marketing-green-600 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
