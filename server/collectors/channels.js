// channels.js — nearby-network channel congestion via system_profiler.
//
// `system_profiler SPAirPortDataType` lists both the current network and an
// "Other Local Wi-Fi Networks" section, each with a "Channel: N (band, width)"
// line. We count how many networks sit on each channel — the Diagnostics
// congestion bar chart. This is real scan data (no sudo), but only sees SSIDs
// the Mac can currently hear; run on demand rather than on a hot loop.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

function parseChannels(raw) {
  const lines = raw.split('\n');
  // Every "Channel: N (...)" occurrence is one network (current + others).
  const counts = new Map(); // channel -> { count, band }
  let ownChannel = null;
  let inCurrent = false;

  for (const line of lines) {
    if (/Current Network Information:/.test(line)) inCurrent = true;
    if (/Other Local Wi-Fi Networks/i.test(line)) inCurrent = false;

    const m = line.match(/^\s+Channel:\s*(\d+)\s*(?:\(([^,)]+))?/);
    if (m) {
      const ch = Number(m[1]);
      const band = m[2]?.trim() || null;
      const rec = counts.get(ch) || { channel: ch, count: 0, band };
      rec.count += 1;
      if (band) rec.band = band;
      counts.set(ch, rec);
      if (inCurrent && ownChannel == null) ownChannel = ch;
    }
  }
  return { counts, ownChannel };
}

export async function getChannelCongestion() {
  let raw = '';
  try {
    ({ stdout: raw } = await execAsync('system_profiler SPAirPortDataType', {
      timeout: 10000,
      maxBuffer: 4 * 1024 * 1024,
    }));
  } catch (err) {
    return { error: err.message, ownChannel: null, channels: [] };
  }

  const { counts, ownChannel } = parseChannels(raw);
  const channels = [...counts.values()].sort((a, b) => a.channel - b.channel);
  return {
    ownChannel,
    total: channels.reduce((n, c) => n + c.count, 0),
    channels, // [{ channel, count, band }]
  };
}
