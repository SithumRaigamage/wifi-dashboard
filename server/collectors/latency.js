// latency.js — ping a reliable host to measure latency + packet loss + jitter.
// Uses the `ping` npm package which wraps the system ping binary.

import ping from 'ping';
import { getSettings } from '../lib/settings.js';

// Rolling window of recent samples so we can report packet loss and jitter over time.
const WINDOW = 20;
const history = [];     // 1 for alive, 0 for loss
const rttHistory = [];  // recent successful ping times in ms

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

  if (time != null) {
    rttHistory.push(time);
    if (rttHistory.length > WINDOW) rttHistory.shift();
  }

  // Jitter calculation: average difference between consecutive ping samples
  let jitterMs = 0;
  if (rttHistory.length >= 2) {
    let diffSum = 0;
    for (let i = 1; i < rttHistory.length; i++) {
      diffSum += Math.abs(rttHistory[i] - rttHistory[i - 1]);
    }
    jitterMs = Math.round((diffSum / (rttHistory.length - 1)) * 10) / 10;
  }

  return {
    host,
    alive,
    latencyMs: time,
    jitterMs,   // Jitter variation in ms
    packetLoss, // % over the recent window
    samples: history.length,
  };
}

