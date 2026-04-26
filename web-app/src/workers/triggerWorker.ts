// triggerWorker.ts — thin Worker shell.
//
// All business logic lives in `triggerCore.ts`; this file only:
//   1. instantiates a TriggerCore with real `Date.now`,
//   2. wires `self.onmessage` into `core.ingest` / `core.manualTrigger` /
//      `core.reset`,
//   3. forwards `core.onTransition` / `core.onTrigger` to `self.postMessage`.
//
// Keeping the shell wafer-thin means Sprint A's reviewer note ("module-scope
// mutable state + top-level self.onmessage made the worker untestable") is
// resolved: the testable surface is `createTriggerCore`, exercised by
// Vitest with no Worker globals.

import type { VitalsFrame } from '../types/vitals';
import type { StateTransition, TriggerEvent } from '../types/state';
import { createTriggerCore, type TriggerCore } from './triggerCore';
import type { StateRulesConfig } from './stateRules';
import rulesJson from '../data/stateRules.json';

type Inbound =
  | { kind: 'vitals'; frame: VitalsFrame }
  | { kind: 'feedback'; transitionId: string; signal: 'helped' | 'neutral' | 'unhelpful' }
  | { kind: 'manual_trigger' }
  | { kind: 'reset' };

type Outbound =
  | { kind: 'state_transition'; transition: StateTransition }
  | { kind: 'trigger'; event: TriggerEvent };

export type { Inbound, Outbound };

const rules = rulesJson as StateRulesConfig;

const core: TriggerCore = createTriggerCore({ rules });

core.onTransition((transition) => {
  const msg: Outbound = { kind: 'state_transition', transition };
  // The Worker `self` is `DedicatedWorkerGlobalScope` at runtime; in Vitest
  // (jsdom/happy-dom) the same import path is exercised but `self` is the
  // window. Guard so the file remains importable from non-Worker contexts.
  (self as unknown as { postMessage: (m: Outbound) => void }).postMessage(msg);
});

core.onTrigger((event) => {
  const msg: Outbound = { kind: 'trigger', event };
  (self as unknown as { postMessage: (m: Outbound) => void }).postMessage(msg);
});

self.onmessage = (e: MessageEvent<Inbound>) => {
  const msg = e.data;
  switch (msg.kind) {
    case 'vitals':
      core.ingest(msg.frame);
      return;
    case 'manual_trigger':
      core.manualTrigger();
      return;
    case 'reset':
      core.reset();
      return;
    case 'feedback':
      // Sprint C wires this to the Memory context. No-op in Sprint B.
      return;
  }
};

export {};
