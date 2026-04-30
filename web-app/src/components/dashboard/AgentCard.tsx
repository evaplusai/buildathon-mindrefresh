/**
 * AgentCard — renders one of three agent cards in the Reflect swarm.
 *
 * Per design HTML lines 884–937.
 *
 * States:
 *   idle     — muted descriptive text, awaiting input
 *   thinking — animated 3-dot loader (ports design HTML `.agent-loading`)
 *   done     — typed payload rendered per agent
 *   error    — rose-tinted "Something went wrong" message
 *
 * Icons are the exact SVG paths from the design HTML per agent.
 *
 * Ownership: ui-coder (Sprint B Block 3).
 */

import type { AgentStatus, PatternScorerOutput, StateMapperOutput, ReframeWriterOutput } from '../../types/reflection';
import { PatternChips } from './PatternChips';

export interface AgentCardProps {
  agent: 1 | 2 | 3;
  status: AgentStatus;
  payload?: PatternScorerOutput | StateMapperOutput | ReframeWriterOutput;
}

// ---------------------------------------------------------------------------
// Per-agent static metadata
// ---------------------------------------------------------------------------

const AGENT_META = {
  1: {
    name: 'Pattern Scorer',
    idleText: 'Awaiting input. Reads language for urgency, catastrophizing, rumination, exhaustion.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path d="M3 12h4l3-9 4 18 3-9h4" />
      </svg>
    ),
  },
  2: {
    name: 'State Mapper',
    idleText: 'Fuses linguistic patterns with sensor signals. Picks one of four states.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  3: {
    name: 'Reverse Affirmation',
    idleText: 'Writes a reflective reframe — observation, not positivity.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
} as const;

// ---------------------------------------------------------------------------
// Status label + colour
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  done: 'Done',
  error: 'Error',
};

const STATUS_CLASS: Record<AgentStatus, string> = {
  idle: 'text-marketing-inkMuted',
  thinking: 'text-[#C99B4F]',
  done: 'text-marketing-green-700',
  error: 'text-marketing-rose',
};

// ---------------------------------------------------------------------------
// Payload renderers per agent
// ---------------------------------------------------------------------------

function Agent1Body({ payload }: { payload: PatternScorerOutput }) {
  return (
    <div>
      <PatternChips chips={payload.patterns} />
    </div>
  );
}

function Agent2Body({ payload }: { payload: StateMapperOutput }) {
  const stateLabel = payload.state.charAt(0).toUpperCase() + payload.state.slice(1);
  return (
    <div className="space-y-1">
      <div className="font-mono text-[12px] text-marketing-green-900 font-semibold">
        State: {stateLabel}
      </div>
      {payload.evidenceTrace && (
        <div className="font-mono text-[10px] text-marketing-inkMuted leading-[1.4]">
          {payload.evidenceTrace}
        </div>
      )}
    </div>
  );
}

function Agent3Body({ payload }: { payload: ReframeWriterOutput }) {
  return (
    <div className="space-y-1">
      <div className="text-[13px] text-marketing-green-900 leading-[1.5]">
        Reframe ready.
      </div>
      {payload.voiceCheck && (
        <div className="font-mono text-[10px] text-marketing-inkMuted italic">
          Voice: {payload.voiceCheck}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dot loader
// ---------------------------------------------------------------------------

function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center" aria-label="Agent processing" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#C99B4F]"
          style={{
            animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function isPatternScorerOutput(payload: unknown): payload is PatternScorerOutput {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'patterns' in payload &&
    Array.isArray((payload as PatternScorerOutput).patterns)
  );
}

function isStateMapperOutput(payload: unknown): payload is StateMapperOutput {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'state' in payload &&
    'evidenceTrace' in payload
  );
}

function isReframeWriterOutput(payload: unknown): payload is ReframeWriterOutput {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'reframe' in payload &&
    'voiceCheck' in payload
  );
}

function AgentBody({ agent, status, payload }: AgentCardProps) {
  const meta = AGENT_META[agent];

  if (status === 'idle') {
    return (
      <span className="text-[13px] text-marketing-inkMuted leading-[1.5]">
        {meta.idleText}
      </span>
    );
  }

  if (status === 'thinking') {
    return <ThinkingDots />;
  }

  if (status === 'error') {
    return (
      <span className="text-[13px] text-marketing-rose">
        Something went wrong. Using fallback output.
      </span>
    );
  }

  // done — render typed payload
  if (status === 'done' && payload) {
    if (agent === 1 && isPatternScorerOutput(payload)) {
      return <Agent1Body payload={payload} />;
    }
    if (agent === 2 && isStateMapperOutput(payload)) {
      return <Agent2Body payload={payload} />;
    }
    if (agent === 3 && isReframeWriterOutput(payload)) {
      return <Agent3Body payload={payload} />;
    }
  }

  return null;
}

export function AgentCard({ agent, status, payload }: AgentCardProps) {
  const meta = AGENT_META[agent];

  return (
    <div
      className={[
        'bg-marketing-warmWhite border border-marketing-line rounded-[16px] p-5',
        'flex flex-col gap-3',
        'transition-all duration-300 ease-in-out',
        status === 'error' ? 'border-marketing-rose/30' : '',
      ].join(' ')}
      data-agent={agent}
      data-status={status}
      role="region"
      aria-label={`${meta.name} agent — ${STATUS_LABEL[status]}`}
    >
      {/* Agent head: icon + name + status */}
      <div className="flex items-center gap-3">
        <div
          className={[
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            status === 'error'
              ? 'bg-marketing-rose/10 text-marketing-rose'
              : 'bg-marketing-green-50 text-marketing-green-800',
          ].join(' ')}
        >
          {meta.icon}
        </div>
        <div>
          <div className="font-serif text-[14px] text-marketing-green-900 font-medium leading-[1.2]">
            {meta.name}
          </div>
          <div
            className={[
              'font-mono text-[10px] tracking-[0.8px] uppercase font-semibold mt-0.5',
              STATUS_CLASS[status],
            ].join(' ')}
            aria-live="polite"
          >
            {STATUS_LABEL[status]}
          </div>
        </div>
      </div>

      {/* Agent body: state-conditional content */}
      <div className="pl-11 min-h-[32px]">
        <AgentBody agent={agent} status={status} payload={payload} />
      </div>
    </div>
  );
}

export default AgentCard;
