// latency.js — ping a reliable host to measure latency + packet loss.
// Uses the `ping` npm package which wraps the system ping binary.

import ping from 'ping';
import { getSettings } from '../lib/settings.js';

// Rolling window of recent samples so we can report packet loss over time
// rather than only per-call (a single ping is loss=0 or 100).
const WINDOW = 20;
const history = [];

export async function getLatency(host = getSettings().pingHost) {
  let alive = false;
  let time = null;
  try {
    const res = await ping.promise.probe(host, {
      timeout: 2, // seconds
      min_reply: 1,
      extra: ['-c', '1'], // macOS/BSD ping: single packet
    });
    alive = res.alive;
    time = res.alive && res.time !== 'unknown' ? Number(res.time) : null;
  } catch {
    alive = false;
  }

  history.push(alive ? 1 : 0);
  if (history.length > WINDOW) history.shift();
  const received = history.reduce((a, b) => a + b, 0);
  const packetLoss = history.length
    ? Math.round(((history.length - received) / history.length) * 100)
    : 0;

  return {
    host,
    alive,
    latencyMs: time,
    packetLoss, // % over the recent window
    samples: history.length,
  };
}
