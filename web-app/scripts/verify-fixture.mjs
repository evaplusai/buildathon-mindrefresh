#!/usr/bin/env node
// Replays public/fixtures/recorded-csi-session.jsonl through a faithful
// in-process copy of the State classifier (src/workers/stateRules.ts) and
// asserts the demo arc fires:  regulated → activated → recovering.
//
// Run with: node web-app/scripts/verify-fixture.mjs
// Exit 0 on success, 1 on failure (so it can gate CI later).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, '..', 'public', 'fixtures', 'recorded-csi-session.jsonl');
const RULES = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'src', 'data', 'stateRules.json'), 'utf8'),
);

class Buf {
  constructor() { this.s = []; }
  push(f) { this.s.push(f); const c = f.ts - 600_000; while (this.s.length && this.s[0].ts < c) this.s.shift(); }
  latest() { return this.s.at(-1); }
  samplesIn(w) { if (!this.s.length) return []; const n = this.s.at(-1).ts; return this.s.filter(x => x.ts >= n - w); }
  spanMs(w) { const xs = this.samplesIn(w); return xs.length < 2 ? undefined : xs.at(-1).ts - xs[0].ts; }
  slopeBreath(w) {
    const xs = this.samplesIn(w).filter(x => x.breathBpm != null);
    if (xs.length < 2) return undefined;
    const dtMin = (xs.at(-1).ts - xs[0].ts) / 60_000;
    return dtMin <= 0 ? undefined : (xs.at(-1).breathBpm - xs[0].breathBpm) / dtMin;
  }
}

const text = readFileSync(FIXTURE, 'utf8');
const frames = text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
const buf = new Buf();
let state = 'regulated';
let lastTs = 0;
const fired = [];

for (const f of frames) {
  buf.push({ ts: f.ts, breathBpm: f.breathing_rate_bpm });
  if (f.ts - lastTs < RULES.debounceSeconds * 1000) continue;
  const breath = f.breathing_rate_bpm;
  if (state === 'regulated') {
    const w = RULES.activated.sustainSeconds * 1000;
    const span = buf.spanMs(w); if (span == null || span < w * 0.95) continue;
    if (breath <= RULES.activated.breathMin) continue;
    const slope = buf.slopeBreath(w); if (slope == null || slope < 1) continue;
    if (!buf.samplesIn(w).every(s => s.breathBpm > RULES.activated.breathMin)) continue;
    fired.push({ tSec: (f.ts - frames[0].ts) / 1000, from: state, to: 'activated' });
    state = 'activated'; lastTs = f.ts;
  } else if (state === 'activated') {
    const w = RULES.recovering.sustainSeconds * 1000;
    const span = buf.spanMs(w); if (span == null || span < w * 0.95) continue;
    const slope = buf.slopeBreath(w); if (slope == null || slope > -0.5) continue;
    fired.push({ tSec: (f.ts - frames[0].ts) / 1000, from: state, to: 'recovering' });
    state = 'recovering'; lastTs = f.ts;
  }
}

console.log(`Fixture: ${frames.length} frames over ${(frames.at(-1).ts - frames[0].ts) / 1000}s`);
console.log('Transitions:'); fired.forEach(t => console.log(`  t=${t.tSec}s ${t.from} → ${t.to}`));

const okAct = fired.some(t => t.to === 'activated');
const okRec = fired.some(t => t.to === 'recovering');
if (!okAct || !okRec) {
  console.error(`\nFAIL — missing transitions (activated=${okAct} recovering=${okRec})`);
  process.exit(1);
}
console.log('\nOK — fixture fires the regulated → activated → recovering arc.');
