import type { VitalsFrame, Unsubscribe } from './vitals';

export type State = 'regulated' | 'activated' | 'recovering';

export type TriggerType =
  | 'acute_spike' | 'slow_drift' | 'recovery' | 'manual' | 'morning_check';

export interface StateTransition {
  id: string;
  ts: number;
  from: State;
  to: State;
  reason: string;
  breathBpm: number;
  hrBpm?: number;
}

export interface MorningCheckPayload {
  yesterdayCount: number;
  lastEventTs: number;
  todayBaseline: number;
  regulatedBaseline: number;
}

export interface TriggerEvent {
  type: TriggerType;
  transitionId: string;
  severity: number;
  ts: number;
  morningPayload?: MorningCheckPayload;
}

export interface StateAPI {
  onTransition(cb: (e: StateTransition) => void): Unsubscribe;
  onTrigger(cb: (e: TriggerEvent) => void): Unsubscribe;
  ingest(v: VitalsFrame): void;
  manualTrigger(): void;
  reset(): void;
}
