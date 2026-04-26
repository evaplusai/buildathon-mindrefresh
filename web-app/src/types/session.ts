import type { State, StateTransition } from './state';
import type { Intervention } from './intervention';
import type { Unsubscribe } from './vitals';

export interface MorningRow {
  id: string;
  ts: number;
  from_state: State;
  to_state: State;
  trigger_reason?: string;
  breath_bpm?: number;
}

export interface MemoryAPI {
  appendTransition(t: StateTransition): Promise<void>;
  appendIntervention(i: Intervention): Promise<void>;
  appendFeedback(f: { transitionId: string; signal: 'helped' | 'neutral' | 'unhelpful' }): Promise<void>;
  appendWhatsAlive(text: string, transitionId: string): Promise<void>;
  recentAffirmationIds(): Promise<string[]>;
  morningCheckQuery(sinceMs: number): Promise<MorningRow[]>;
  onPersisted(cb: (e: { kind: 'transition' | 'intervention' | 'feedback' | 'whats_alive' }) => void): Unsubscribe;
}
