#!/usr/bin/env node
// stream-watch.mjs — connect to the sensing-server WebSocket and print
// breath/HR/presence/motion in a single rolling line. Ctrl-C to quit.
//
// Usage:  node scripts/stream-watch.mjs [ws://localhost:8765/ws/sensing]

// Uses Node 22+ built-in global WebSocket — no `ws` package needed.

const url = process.argv[2] ?? 'ws://localhost:8765/ws/sensing';
const ws = new WebSocket(url);

let lastTs = 0;
let frames = 0;

ws.addEventListener('open', () => {
  process.stderr.write(`>> connected to ${url}\n>> waiting for frames...\n`);
});

ws.addEventListener('message', (event) => {
  let msg;
  const data = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString();
  try { msg = JSON.parse(data); } catch { return; }
  frames++;
  const breath = (msg.breathing_rate_bpm ?? msg.breath_rate_bpm ?? 0).toFixed(1);
  const hr     = (msg.heart_rate_bpm ?? 0).toFixed(1);
  const pres   = msg.presence ? 'YES' : ' no';
  const motion = (msg.motion_band_power ?? 0).toFixed(2);
  const ts     = msg.ts ?? Date.now();
  const dt     = lastTs ? ((ts - lastTs) / 1000).toFixed(2) : '----';
  lastTs = ts;
  // Single-line rolling display.
  process.stdout.write(
    `\r[${frames.toString().padStart(5)}] ` +
    `breath ${breath.padStart(5)} BPM | ` +
    `HR ${hr.padStart(5)} BPM | ` +
    `presence ${pres} | ` +
    `motion ${motion.padStart(5)} | ` +
    `dt ${dt}s `
  );
});

ws.addEventListener('error', (e) => {
  process.stderr.write(`\nerror: ${e.message ?? 'WebSocket error'}\n`);
  process.exit(1);
});

ws.addEventListener('close', () => {
  process.stderr.write('\n>> stream closed\n');
  process.exit(0);
});

process.on('SIGINT', () => { ws.close(); });
