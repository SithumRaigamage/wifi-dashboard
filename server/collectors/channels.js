// channels.js — nearby-network channel congestion via system_profiler.
//
// `system_profiler SPAirPortDataType` lists both the current network and an
// "Other Local Wi-Fi Networks" section, each with a "Channel: N (band, width)"
// line. We count how many networks sit on each channel — the Diagnostics
// congestion bar chart. This is real scan data (no sudo), but only sees SSIDs
// the Mac can currently hear; run on demand rather than on a hot loop.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { parseChannelValue, parseKeyValueLine } from './airportParse.js';

const execAsync = promisify(exec);

function parseChannels(lines) {
  // Every "Channel: N (...)" occurrence is one network (current + others).
  const counts = new Map(); // channel -> { count, band }
  let ownChannel = null;
  let inCurrent = false;

  for (const line of lines) {
    if (/Current Network Information:/.test(line)) inCurrent = true;
    if (/Other Local Wi-Fi Networks/i.test(line)) inCurrent = false;

    const m = line.match(/^\s+Channel:\s*(.+)$/);
    if (m) {
      const { channel: ch, band } = parseChannelValue(m[1]);
      if (ch == null) continue;
      const rec = counts.get(ch) || { channel: ch, count: 0, band };
      rec.count += 1;
      if (band) rec.band = band;
      counts.set(ch, rec);
      if (inCurrent && ownChannel == null) ownChannel = ch;
    }
  }
  return { counts, ownChannel };
}

// US-15 (rogue-AP detection): per-network detail for "Other Local Wi-Fi
// Networks", not just the channel counts parseChannels() extracts. Each
// network is a bare "<name>:" line followed by more-indented key/value
// properties; the block ends when indentation drops back to (or below) the
// section header's own level — e.g. the next interface's "awdl0:" line.
// Note: without Location Services permission (the norm for a plain Node
// process — see wifiStats.js), the "<name>" is macOS's literal redacted
// placeholder for every nearby network, and no BSSID line is present at all;
// this parser still returns entries, security.js is responsible for treating
// unresolved/redacted names as "can't compare" rather than a false match.
function parseNetworks(lines) {
  const headerIdx = lines.findIndex((l) => /Other Local Wi-Fi Networks:\s*$/.test(l));
  if (headerIdx === -1) return [];
  const headerIndent = lines[headerIdx].match(/^(\s*)/)[1].length;

  const networks = [];
  let current = null;
  let nameIndent = null;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= headerIndent) break; // left the "Other Local Wi-Fi Networks" block

    // Greedy `.+` (not `[^:]+`) so an SSID that itself contains a colon (rare,
    // but valid) doesn't break this match — `:\s*$` still correctly excludes
    // any real "key: value" property line, since only a bare name line ends
    // with nothing but whitespace after its final colon.
    const bareName = line.match(/^\s+(.+):\s*$/);
    if (bareName && (nameIndent == null || indent === nameIndent)) {
      nameIndent = indent;
      current = { ssid: bareName[1].trim(), bssid: null, channel: null, band: null, security: null, rssi: null };
      networks.push(current);
      continue;
    }
    if (!current || indent <= nameIndent) continue; // stray/unexpected line — ignore rather than misattribute

    const kv = parseKeyValueLine(line);
    if (!kv) continue;
    const { key, value: val } = kv;
    switch (key) {
      case 'BSSID':
        current.bssid = val;
        break;
      case 'Security':
        current.security = val;
        break;
      case 'Channel': {
        const { channel, band } = parseChannelValue(val);
        current.channel = channel;
        current.band = band;
        break;
      }
      case 'Signal / Noise': {
        const sm = val.match(/(-?\d+)\s*dBm/);
        if (sm) current.rssi = Number(sm[1]);
        break;
      }
      default:
        break;
    }
  }
  return networks;
}

export async function getChannelCongestion() {
  let raw = '';
  try {
    ({ stdout: raw } = await execAsync('system_profiler SPAirPortDataType', {
      timeout: 10000,
      maxBuffer: 4 * 1024 * 1024,
    }));
  } catch (err) {
    return { error: err.message, ownChannel: null, channels: [], networks: [] };
  }

  const lines = raw.split('\n');
  const { counts, ownChannel } = parseChannels(lines);
  const channels = [...counts.values()].sort((a, b) => a.channel - b.channel);
  return {
    ownChannel,
    total: channels.reduce((n, c) => n + c.count, 0),
    channels, // [{ channel, count, band }]
    networks: parseNetworks(lines), // [{ ssid, bssid, channel, band, security, rssi }]
  };
}
