// wifiStats.js — macOS WiFi link info + throughput.
//
// On macOS 15+ (incl. 26 "Tahoe") the old `airport` CLI is gone and
// `networksetup -getairportnetwork` is broken. The reliable no-sudo source for
// signal strength / channel / tx rate is `system_profiler SPAirPortDataType`.
// It's slowish (~1-2s), so callers should poll it less often than throughput.
//
// Note: SSID/BSSID are redacted by macOS unless the process has Location
// Services permission, which a plain Node process won't have. RSSI, channel,
// PHY mode and tx rate still come through fine.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import si from 'systeminformation';
import { parseChannelValue, parseKeyValueLine } from './airportParse.js';

const execAsync = promisify(exec);

// The primary Wi-Fi interface on most Macs is en0. We resolve it via the
// default route rather than systeminformation's type==='wireless', because the
// latter can match virtual AP/AWDL interfaces (ap1, awdl0) that carry no
// real traffic — reading throughput on those returns all zeros.
let cachedWifiIface = null;

async function getWifiInterface() {
  if (cachedWifiIface) return cachedWifiIface;
  try {
    const { stdout } = await execAsync('route -n get default', { timeout: 3000 });
    const m = stdout.match(/interface:\s*(\S+)/);
    cachedWifiIface = m ? m[1] : 'en0';
  } catch {
    cachedWifiIface = 'en0';
  }
  return cachedWifiIface;
}

// Parse the `Current Network Information` block out of system_profiler output.
function parseAirportData(raw) {
  const result = {
    ssid: null,
    bssid: null,
    phyMode: null,
    channel: null,
    band: null,
    channelWidth: null,
    rssi: null,
    noise: null,
    txRate: null,
    mcsIndex: null,
    security: null,
  };

  const lines = raw.split('\n');
  const startIdx = lines.findIndex((l) => /Current Network Information:/.test(l));
  if (startIdx === -1) return result;

  // The SSID is the first indented key line after the header.
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s+([^:]+):\s*$/);
    if (m) {
      const name = m[1].trim();
      // Stop if we've walked into the "Other Local Wi-Fi Networks" section.
      if (/Other Local Wi-Fi Networks/i.test(name)) break;
      result.ssid = name;
      break;
    }
  }

  // Walk the block until indentation drops back out (next top-level key).
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/Other Local Wi-Fi Networks/i.test(line)) break;

    const kv = parseKeyValueLine(line);
    if (!kv) continue;
    const { key, value: val } = kv;

    switch (key) {
      case 'BSSID':
        result.bssid = val;
        break;
      case 'PHY Mode':
        result.phyMode = val;
        break;

      case 'Channel': {
        const { channel, band, channelWidth } = parseChannelValue(val);
        result.channel = channel;
        result.band = band;
        result.channelWidth = channelWidth;
        break;
      }
      case 'Signal / Noise': {
        // e.g. "-50 dBm / -87 dBm"
        const sm = val.match(/(-?\d+)\s*dBm\s*\/\s*(-?\d+)\s*dBm/);
        if (sm) {
          result.rssi = Number(sm[1]);
          result.noise = Number(sm[2]);
        }
        break;
      }
      case 'Transmit Rate':
        result.txRate = Number(val) || null;
        break;
      case 'MCS Index':
        result.mcsIndex = Number(val);
        break;
      case 'Security':
        result.security = val;
        break;
      default:
        break;
    }
  }

  return result;
}

// Map RSSI (dBm) to a coarse quality bucket + 0-100 score for the UI gauge.
function rssiToQuality(rssi) {
  if (rssi == null) return { label: 'Unknown', score: null };
  // Typical usable range: -30 (excellent) to -90 (unusable).
  const score = Math.max(0, Math.min(100, Math.round(((rssi + 90) / 60) * 100)));
  let label = 'Poor';
  if (rssi >= -50) label = 'Excellent';
  else if (rssi >= -60) label = 'Good';
  else if (rssi >= -70) label = 'Fair';
  return { label, score };
}

export async function getWifiStats() {
  const iface = await getWifiInterface();

  let airport = {};
  try {
    const { stdout } = await execAsync('system_profiler SPAirPortDataType', {
      timeout: 8000,
      maxBuffer: 4 * 1024 * 1024,
    });
    airport = parseAirportData(stdout);
  } catch (err) {
    airport = { error: `system_profiler failed: ${err.message}` };
  }

  const quality = rssiToQuality(airport.rssi);

  return {
    iface,
    ssid: airport.ssid,
    bssid: airport.bssid,
    connected: airport.rssi != null,
    rssi: airport.rssi,
    noise: airport.noise,
    snr: airport.rssi != null && airport.noise != null ? airport.rssi - airport.noise : null,
    quality: quality.label,
    qualityScore: quality.score,
    channel: airport.channel,
    band: airport.band,
    channelWidth: airport.channelWidth,
    phyMode: airport.phyMode,
    txRate: airport.txRate, // Mbps (negotiated link rate)
    mcsIndex: airport.mcsIndex,
    security: airport.security,
    error: airport.error || null,
  };

}

// Throughput is cheap and fast — poll this more often than getWifiStats().
// systeminformation.networkStats gives per-interface tx/rx bytes and rates.
export async function getThroughput() {
  const iface = await getWifiInterface();
  try {
    const stats = await si.networkStats(iface);
    const s = Array.isArray(stats) ? stats[0] : stats;
    if (!s) return { iface, error: 'no stats' };
    return {
      iface: s.iface,
      rxBytes: s.rx_bytes,
      txBytes: s.tx_bytes,
      rxSec: s.rx_sec != null && s.rx_sec >= 0 ? s.rx_sec : 0, // bytes/sec
      txSec: s.tx_sec != null && s.tx_sec >= 0 ? s.tx_sec : 0,
      ms: s.ms, // interval over which the rate was measured
    };
  } catch (err) {
    return { iface, error: err.message };
  }
}
