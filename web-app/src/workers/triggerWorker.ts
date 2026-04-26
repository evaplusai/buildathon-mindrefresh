import type { VitalsFrame } from '../types/vitals';
import type { State, StateTransition, TriggerEvent } from '../types/state';

type Inbound =
  | { kind: 'vitals'; frame: VitalsFrame }
  | { kind: 'feedback'; transitionId: string; signal: 'helped' | 'neutral' | 'unhelpful' }
  | { kind: 'manual_trigger' }
  | { kind: 'reset' };

type Outbound =
  | { kind: 'state_transition'; transition: StateTransition }
  | { kind: 'trigger'; event: TriggerEvent };

let currentState: State = 'regulated';

// Outbound type retained for Sprint B wiring; reference to silence unused warnings.
export type { Inbound, Outbound };

self.onmessage = (e: MessageEvent<Inbound>) => {
  // Sprint B will wire the classifier + 5 detectors here.
  // For Sprint A, the worker is a passthrough echo for smoke tests.
  if (e.data.kind === 'reset') currentState = 'regulated';
  void currentState;
};

export {};
