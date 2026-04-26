import type { State } from './state';
import type { Unsubscribe } from './vitals';

export type Modality = 'breath' | 'witness' | 'anchor';
export type BreathPattern = 'natural' | 'cyclic_sigh' | 'extended_exhale';

export interface Affirmation {
  id: string;
  state: State;
  text: string;
  modality: Modality;
}

export interface Intervention {
  transitionId: string;
  affirmationId: string;
  breathPattern: BreathPattern;
  ts: number;
}

export interface InterventionAPI {
  pick(input: { state: State; transitionId: string; recentIds: string[] }): Intervention;
  onRendered(cb: (e: Intervention) => void): Unsubscribe;
  recordFeedback(transitionId: string, signal: 'helped' | 'neutral' | 'unhelpful'): void;
  onFeedback(cb: (e: { transitionId: string; signal: 'helped' | 'neutral' | 'unhelpful' }) => void): Unsubscribe;
}
