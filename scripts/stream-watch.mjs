#!/usr/bin/env node
// stream-watch.mjs — connect to the sensing-server WebSocket and print
// breath/HR/presence/motion in a single rolling line. Ctrl-C to quit.
//
// Usage:  node scripts/stream-watch.mjs [ws://localhost:8765/ws/sensing]

import WebSocket from 'ws';

const url = process.argv[2] ?? 'ws://localhost:8765/ws/sensing';
const ws = new WebSocket(url);

let lastTs = 0;
let frames = 0;

ws.on('open', () => {
  process.stderr.write(`>> connected to ${url}\n>> waiting for frames...\n`);
});

ws.on('message', (buf) => {
  let msg;
  try { msg = JSON.parse(buf.toString()); } catch { return; }
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

ws.on('error', (e) => {
  process.stderr.write(`\nerror: ${e.message}\n`);
  process.exit(1);
});

ws.on('close', () => {
  process.stderr.write('\n>> stream closed\n');
  process.exit(0);
});

process.on('SIGINT', () => { ws.close(); });
