/**
 * ReflectCard — the three-agent swarm UI surface.
 *
 * Per design HTML lines 851–947 and ADR-016 / ADR-018.
 *
 * Structure:
 *   - Eyebrow + H2 + subhead
 *   - Textarea + "Reflect →" submit button
 *   - 4 sample prompt buttons
 *   - 3 <AgentCard> components in a grid
 *   - <ReframeBlock> reveal on completion
 *
 * Behaviour:
 *   - Cmd/Ctrl+Enter inside textarea submits.
 *   - On submit: disable button, call reflectClient.start(), stream events
 *     into per-agent state, call callbacks on completion, re-enable.
 *
 * Ownership: ui-coder (Sprint B Block 3).
 */

import { useCallback, useRef, useState } from 'react';

import type { DashboardState, BreathProtocol } from '../../types/display';
import type {
  AgentStatus,
  PatternScorerOutput,
  StateMapperOutput,
  ReframeWriterOutput,
  PatternKey,
} from '../../types/reflection';
import { createReflectClient } from '../../services/reflect/reflectClient';
import { AgentCard } from './AgentCard';
import { ReframeBlock } from './ReframeBlock';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReflectCardProps {
  sensorState: DashboardState;
  breathBpm?: number;
  onAdvisory?: (advised: DashboardState, sensor: DashboardState) => void;
  onProtocolAdvisory?: (protocol: BreathProtocol) => void;
  /** Optional content rendered inside the Reflect panel below the chat,
   *  separated by a divider — used to embed the Reset CTA so it appears
   *  as part of the same panel rather than a separate card. */
  footer?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Per-agent state
// ---------------------------------------------------------------------------

interface AgentState {
  status: AgentStatus;
  payload?: PatternScorerOutput | StateMapperOutput | ReframeWriterOutput;
}

const INITIAL_AGENT_STATE: AgentState = { status: 'idle' };

// ---------------------------------------------------------------------------
// Sample prompts (per design HTML lines 871–874)
// ---------------------------------------------------------------------------

const SAMPLES = [
  { label: '"I\'m so behind on everything"',     full: "I'm so behind on everything. I can't catch up." },
  { label: '"Everything is fine, just tired"',   full: 'Everything is fine. I\'m just tired, that\'s all.' },
  { label: '"So much to do, head spinning"',      full: "I have so much to do and I don't know where to start. My head is spinning." },
] as const;

// ---------------------------------------------------------------------------
// Singleton client — created once, shared across renders
// ---------------------------------------------------------------------------

const reflectClient = createReflectClient();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReflectCard({ sensorState, breathBpm, onAdvisory, onProtocolAdvisory, footer }: ReflectCardProps) {
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [swarmVisible, setSwarmVisible] = useState(false);

  const [agent1, setAgent1] = useState<AgentState>(INITIAL_AGENT_STATE);
  const [agent2, setAgent2] = useState<AgentState>(INITIAL_AGENT_STATE);
  const [agent3, setAgent3] = useState<AgentState>(INITIAL_AGENT_STATE);

  const [reframeData, setReframeData] = useState<{
    reframe: string;
    state: DashboardState;
    patternKeys: PatternKey[];
    protocol?: BreathProtocol;
    protocolReason?: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    const text = inputText.trim();
    if (!text || submitting) return;

    // Reset per-run state
    setSubmitting(true);
    setSwarmVisible(true);
    setReframeData(null);
    setAgent1(INITIAL_AGENT_STATE);
    setAgent2(INITIAL_AGENT_STATE);
    setAgent3(INITIAL_AGENT_STATE);

    const { stream, runPromise } = reflectClient.start(text, {
      sensorState,
      breathBpm,
    });

    // Consume the stream for UI updates
    const reader = stream.getReader();
    void (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          if (value.kind === 'agent-status') {
            const setter =
              value.agent === 1 ? setAgent1 : value.agent === 2 ? setAgent2 : setAgent3;
            setter((prev) => ({ ...prev, status: value.status }));
          } else if (value.kind === 'agent-payload') {
            const setter =
              value.agent === 1 ? setAgent1 : value.agent === 2 ? setAgent2 : setAgent3;
            setter((prev) => ({
              ...prev,
              payload: value.payload as PatternScorerOutput | StateMapperOutput | ReframeWriterOutput,
            }));
          } else if (value.kind === 'error') {
            // On error, mark all non-done agents as error
            setAgent1((a) => a.status !== 'done' ? { status: 'error' } : a);
            setAgent2((a) => a.status !== 'done' ? { status: 'error' } : a);
            setAgent3((a) => a.status !== 'done' ? { status: 'error' } : a);
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();

    // Await full run completion
    try {
      const run = await runPromise;

      // Extract pattern keys from the run for the meta line
      const patternKeys = run.patternScores.patterns.map((p) => p.key);

      setReframeData({
        reframe: run.reframe.reframe,
        state: run.stateMapping.state,
        patternKeys,
        protocol: run.reframe.protocol,
        protocolReason: run.reframe.protocolReason,
      });

      // Fire callbacks
      onAdvisory?.(run.stateMapping.state, sensorState);
      onProtocolAdvisory?.(run.reframe.protocol);
    } catch {
      // Run failed entirely — mark any idle agent as error
      setAgent1((a) => a.status === 'idle' ? { status: 'error' } : a);
      setAgent2((a) => a.status === 'idle' ? { status: 'error' } : a);
      setAgent3((a) => a.status === 'idle' ? { status: 'error' } : a);
    } finally {
      setSubmitting(false);
    }
  }, [inputText, submitting, sensorState, breathBpm, onAdvisory, onProtocolAdvisory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleSampleClick = useCallback((full: string) => {
    setInputText(full);
    textareaRef.current?.focus();
  }, []);

  return (
    <section
      className="bg-marketing-warmWhite border border-marketing-line rounded-[22px] p-9 relative overflow-hidden h-full"
      aria-label="Reflect — agent swarm"
    >
      {/* Left accent bar (Sprint A placeholder carried over) */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-marketing-green-600 to-marketing-green-300" aria-hidden="true" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[2px] text-marketing-green-700 uppercase font-semibold mb-3">
          <span className="w-[6px] h-[6px] rounded-full bg-marketing-green-400" aria-hidden="true" />
          Reflect &middot; agent swarm
        </div>

        <h2 className="font-serif text-[28px] text-marketing-green-900 font-medium tracking-[-0.4px] mb-3">
          Type how you feel.{' '}
          <em className="italic text-marketing-green-600 font-medium">Watch your body show up.</em>
        </h2>

        <p className="text-[15px] text-marketing-inkSoft leading-[1.6] max-w-[700px]">
          Three agents read your language for nervous-system signals, map the pattern to a state,
          and write a reflective reframe — all in under five seconds, all running locally.
        </p>
      </div>

      {/* Input area */}
      <div className="flex gap-3 mb-4">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind right now?"
          rows={2}
          disabled={submitting}
          className={[
            'flex-1 rounded-[12px] bg-marketing-cream border border-marketing-line',
            'px-4 py-3 text-[15px] text-marketing-ink placeholder:text-marketing-inkMuted',
            'focus:outline-none focus:border-marketing-green-600',
            'resize-none transition-colors duration-200',
            submitting ? 'opacity-60 cursor-not-allowed' : '',
          ].join(' ')}
          aria-label="Reflection input"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || !inputText.trim()}
          className={[
            'flex items-center gap-2 px-5 py-3 rounded-[12px]',
            'bg-marketing-green-900 text-marketing-cream',
            'font-mono text-[13px] tracking-[1px] font-semibold',
            'transition-opacity duration-200',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'hover:enabled:bg-marketing-green-800',
          ].join(' ')}
          aria-label="Submit reflection"
        >
          Reflect
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>

      {/* Sample buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="font-mono text-[10px] tracking-[1.5px] text-marketing-inkMuted uppercase font-semibold">
          Try
        </span>
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => handleSampleClick(s.full)}
            disabled={submitting}
            className={[
              'px-3 py-1.5 rounded-full border border-marketing-line',
              'font-mono text-[11px] text-marketing-inkSoft',
              'hover:enabled:border-marketing-green-600 hover:enabled:text-marketing-green-900',
              'transition-colors duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Swarm section */}
      {swarmVisible && (
        <div>
          {/* Swarm running label */}
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[1.5px] text-marketing-inkMuted uppercase font-semibold mb-4">
            <span className="w-[6px] h-[6px] rounded-full bg-marketing-green-400 animate-pulse" aria-hidden="true" />
            Swarm running &middot; 3 agents in parallel
          </div>

          {/* Agent cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <AgentCard agent={1} status={agent1.status} payload={agent1.payload} />
            <AgentCard agent={2} status={agent2.status} payload={agent2.payload} />
            <AgentCard agent={3} status={agent3.status} payload={agent3.payload} />
          </div>

          {/* Reframe reveal */}
          {reframeData && (
            <ReframeBlock
              reframe={reframeData.reframe}
              state={reframeData.state}
              patternKeys={reframeData.patternKeys}
              protocol={reframeData.protocol}
              protocolReason={reframeData.protocolReason}
            />
          )}
        </div>
      )}

      {/* Optional footer slot — used to inline the Reset CTA inside the
          same panel as the chat (Dashboard passes <ResetCard nested />). */}
      {footer ? (
        <div className="mt-8 pt-8 border-t border-marketing-lineSoft">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export default ReflectCard;
