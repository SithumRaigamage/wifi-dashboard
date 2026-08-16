// index.js — WiFi monitoring backend.
// Express REST endpoints (initial load / fallback) + WebSocket live push,
// self-scheduling poll loops, event detection (disconnects / new devices /
// threshold breaches) and on-demand diagnostics. Persistence is MySQL.

import './lib/env.js'; // MUST be first: loads server/.env into process.env
import { logger, scoped } from './lib/logger.js';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { getWifiStats, getThroughput } from './collectors/wifiStats.js';
import { getLatency } from './collectors/latency.js';
import { getLanDevices } from './collectors/lanDevices.js';
import { runSpeedTest } from './collectors/speedtest.js';
import { getChannelCongestion } from './collectors/channels.js';
import { getDnsTiming } from './collectors/dns.js';
import { runTraceroute } from './collectors/traceroute.js';
import { scanPorts } from './collectors/portScanner.js';
import { scanRouterAdminPortal, getDefaultGatewayIp } from './collectors/routerScanner.js';
import { initDb } from './lib/db.js';
import {
  insertSnapshot,
  pruneOld,
  getHistory,
  getHeatmap,
  getSummary,
  exportRows,
} from './lib/history.js';
import { logEvent, listEvents, pruneEvents } from './lib/events.js';
import { getSettings, updateSettings } from './lib/settings.js';
import { sendAlertEmail, sendTestEmail } from './lib/email.js';
import { detectRogueAccessPoints } from './lib/security.js';
import { createBandwidthHogTracker } from './lib/bandwidthTracker.js';


const PORT = process.env.PORT || 4000;
const log = scoped('server');

// Latest snapshots, served by REST and pushed on WS connect.
const latest = {
  wifi: null,
  throughput: null,
  latency: null,
  devices: null,
  speedtest: null,
};

let speedtestRunning = false;
let devicesScanning = false;
const HISTORY_INTERVAL = 5000; // persist a snapshot this often
const DNS_INTERVAL = 30000; // DNS timing is cheap-ish; refresh periodically

// Downtime tracking (per calendar day), feeds the Alerts "downtime today" stat.
const downtime = { since: null, todayMs: 0, day: new Date().toDateString() };

// Edge-trigger state so threshold breaches fire once on entering a bad state,
// not every poll while it persists.
const alertState = { connected: true, signalLow: false, latencyHigh: false, lossHigh: false };

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(msg, (err) => {
        if (err) log.debug(`ws send error: ${err.message}`);
      });
    }
  }
}

// Central event emit: persist, push over WS, and forward warning/danger events
// to the configured webhook and/or email. Persistence is awaited; the outbound
// notifications are fire-and-forget so a slow SMTP/webhook can't stall a loop.
async function emitEvent({ kind, severity = 'info', message, meta = null }) {
  const event = await logEvent({ kind, severity, message, meta });
  broadcast('event', event);
  // Surface every detected event in the app log at a level matching its severity.
  // App severities (info | warning | danger) → Winston levels (info | warn | error).
  const logLevel = { danger: 'error', warning: 'warn', info: 'info' }[severity] || 'info';
  logger.log(logLevel, `event: ${message}`, { kind });
  const s = getSettings();
  if (severity !== 'info') {
    if (s.pushAlerts && s.webhookUrl) {
      log.debug(`dispatching webhook for ${kind}`);
      pushToWebhook(s.webhookUrl, `[WiFi ${severity}] ${message}`).catch(() => {});
    }
    if (s.emailAlerts) {
      log.debug(`dispatching email for ${kind}`);
      sendAlertEmail(`WiFi alert: ${kind}`, `${message}\n\nSeverity: ${severity}`).catch(() => {});
    }
  }
  return event;
}

// Slack uses { text }, Discord uses { content }. Send both keys so one URL works
// for either without the user telling us which service it is.
async function pushToWebhook(url, text) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text }),
    });
  } catch (err) {
    log.error(`webhook push failed: ${err.message}`);
  }
}

// --- REST endpoints --------------------------------------------------------

app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get('/api/wifi', (_req, res) => res.json(latest.wifi ?? {}));
app.get('/api/throughput', (_req, res) => res.json(latest.throughput ?? {}));
app.get('/api/latency', (_req, res) => res.json(latest.latency ?? {}));
app.get('/api/devices', (_req, res) => res.json(latest.devices ?? { devices: [] }));
app.get('/api/speedtest', (_req, res) => res.json(latest.speedtest ?? {}));

app.get('/api/history', async (req, res) => {
  const range = req.query.range === '24h' ? '24h' : '1h';
  res.json({ range, points: await getHistory(range) });
});
app.get('/api/history/heatmap', async (_req, res) => res.json({ grid: await getHeatmap() }));
app.get('/api/history/summary', async (req, res) => {
  const hours = req.query.range === 'week' ? 24 * 7 : 24;
  res.json((await getSummary(hours)) ?? {});
});
app.get('/api/history/export.csv', async (req, res) => {
  const range = req.query.range === '1h' ? '1h' : '24h';
  const rows = await exportRows(range);
  const header = 'timestamp,rssi_dbm,download_mbps,upload_mbps,latency_ms,loss_pct\n';
  const body = rows
    .map((r) => {
      const mbps = (b) => (b == null ? '' : ((b * 8) / 1e6).toFixed(3));
      return [new Date(r.ts).toISOString(), r.rssi ?? '', mbps(r.rx_sec), mbps(r.tx_sec), r.latency ?? '', r.loss ?? ''].join(',');
    })
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="wifi-history-${range}.csv"`);
  res.send(header + body);
});

// Events / alerts.
app.get('/api/events', async (req, res) => {
  res.json({ events: await listEvents(req.query.limit) });
});
app.delete('/api/events', async (_req, res) => {
  await pruneEvents(0); // clear all
  broadcast('events-cleared', {});
  res.json({ ok: true });
});
app.get('/api/downtime', (_req, res) => res.json(downtimeStat()));

// Settings (thresholds + toggles + poll cadences live here too).
app.get('/api/settings', (_req, res) => res.json(getSettings()));
app.put('/api/settings', (req, res) => {
  const next = updateSettings(req.body || {});
  broadcast('settings', next);
  res.json(next);
});

// Send a test email with the current SMTP settings.
app.post('/api/email/test', async (_req, res) => {
  try {
    await sendTestEmail();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Diagnostics.
app.get('/api/diagnostics/channels', async (_req, res) => {
  try {
    const data = await getChannelCongestion();
    if (data && Array.isArray(data.networks) && latest.wifi) {
      const rogues = detectRogueAccessPoints(latest.wifi, data.networks);
      rogueApCooldown.prune();
      for (const rogue of rogues) {
        if (!rogueApCooldown.tryFire(rogueApKey(rogue))) continue;
        await emitEvent({
          kind: 'rogue-ap-detected',
          severity: 'warning',
          message: `${rogue.reason} — could be a mesh/extender node broadcasting the same network name, or a genuine rogue AP`,
          meta: rogue,
        });
      }
      data.rogueAccessPoints = rogues;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/diagnostics/dns', async (_req, res) => {
  try {
    res.json(await getDnsTiming());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/diagnostics/traceroute', async (req, res) => {
  try {
    const result = await runTraceroute(String(req.body?.target || '').trim());
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public read-only status summary (gated by the Settings toggle). Intended for
// sharing "is the WiFi up?" without exposing device/config detail.
app.get('/api/status/public', (_req, res) => {
  if (!getSettings().publicStatus) return res.status(403).json({ error: 'public status disabled' });
  res.json({
    online: Boolean(latest.wifi?.connected) && (latest.latency?.alive ?? false),
    quality: latest.wifi?.quality ?? null,
    downloadMbps: latest.throughput?.rxSec != null ? Number(((latest.throughput.rxSec * 8) / 1e6).toFixed(1)) : null,
    latencyMs: latest.latency?.latencyMs ?? null,
    downtimeTodayMin: Math.round(downtimeStat().todayMs / 60000),
    ts: new Date().toISOString(),
  });
});

// US-19: on-demand TCP port check for one LAN device (SSH/HTTP/HTTPS/SMB/HTTP-alt).
// POST (like /api/devices/scan and /api/speedtest/run) rather than GET — this triggers
// a real TCP scan of another device, and a GET could be fired cross-origin via a plain
// <img src> with no JS. Also restricted to IPs the dashboard has actually discovered
// (self + latest arp scan) so it can't be used to sweep arbitrary private addresses.
app.post('/api/devices/scan-ports', async (req, res) => {
  const ip = String(req.body?.ip || '').trim();
  const known =
    ip === latest.devices?.selfIp || latest.devices?.devices?.some((d) => d.ip === ip);
  if (!known) return res.status(404).json({ error: 'not a known LAN device' });
  try {
    res.json(await scanPorts(ip));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// US-25: on-demand check of the router's own admin portal (HTTP vs HTTPS).
// POST, matching scan-ports — this fires real HTTP requests. No target param:
// the gateway is resolved server-side (`route -n get default`) rather than
// trusting a client-supplied IP, since this endpoint's whole purpose is
// "scan my own router," not a general scan-anything primitive.
app.post('/api/diagnostics/router-scan', async (_req, res) => {
  try {
    const gatewayIp = await getDefaultGatewayIp();
    if (!gatewayIp) return res.status(503).json({ error: 'could not resolve default gateway' });
    res.json(await scanRouterAdminPortal(gatewayIp));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Trigger an immediate device rescan on demand.
app.post('/api/devices/scan', async (_req, res) => {
  try {
    const data = await runDeviceScan({ sweep: true });
    if (!data) return res.status(409).json({ error: 'a scan is already running' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run a speed test on demand. Guarded so overlapping requests don't stack.
app.post('/api/speedtest/run', async (_req, res) => {
  if (speedtestRunning) return res.status(409).json({ error: 'already running' });
  speedtestRunning = true;
  broadcast('speedtest', { running: true });
  try {
    const result = await runSpeedTest();
    latest.speedtest = result;
    broadcast('speedtest', { running: false, ...result });
    res.json(result);
  } catch (err) {
    broadcast('speedtest', { running: false, error: err.message });
    res.status(500).json({ error: err.message });
  } finally {
    speedtestRunning = false;
  }
});

wss.on('connection', (ws) => {
  log.debug(`ws client connected (${wss.clients.size} total)`);
  ws.on('close', () => log.debug(`ws client disconnected (${wss.clients.size} total)`));
  ws.on('error', (err) => log.debug(`ws client error: ${err.message}`));
  // Send whatever we have immediately so the UI isn't blank until the next tick.
  for (const [type, data] of Object.entries(latest)) {
    if (data) {
      ws.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }), (err) => {
        if (err) log.debug(`ws initial send error: ${err.message}`);
      });
    }
  }
});

// --- Event detection -------------------------------------------------------

function downtimeStat() {
  // Roll the counter over at midnight.
  const day = new Date().toDateString();
  if (day !== downtime.day) {
    downtime.day = day;
    downtime.todayMs = 0;
    if (downtime.since) downtime.since = Date.now();
  }
  const ongoing = downtime.since ? Date.now() - downtime.since : 0;
  return { todayMs: downtime.todayMs + ongoing, down: Boolean(downtime.since) };
}

let lastBssid = null;
let lastChannel = null;

async function handleWifi(data) {
  latest.wifi = data;
  broadcast('wifi', data);
  const s = getSettings();

  // Roaming / Access Point Handover & DFS Radar Hop detection
  if (data.connected) {
    const isDfsChannel = (ch) => ch >= 52 && ch <= 144;
    if (lastChannel && isDfsChannel(lastChannel) && data.channel && !isDfsChannel(data.channel)) {
      await emitEvent({
        kind: 'dfs-radar-hop',
        severity: 'warning',
        message: `DFS Radar interference detected! AP hopped from DFS Ch ${lastChannel} to non-DFS Ch ${data.channel}`,
        meta: { oldChannel: lastChannel, newChannel: data.channel },
      });
    } else if (lastBssid && data.bssid && data.bssid !== lastBssid) {
      await emitEvent({
        kind: 'wifi-roam',
        severity: 'info',
        message: `Wi-Fi roamed to AP ${data.bssid} (${data.band || '5GHz'}, Ch ${data.channel})`,
        meta: { oldBssid: lastBssid, newBssid: data.bssid, channel: data.channel, band: data.band },
      });
    } else if (lastChannel && data.channel && data.channel !== lastChannel && !data.bssid) {
      await emitEvent({
        kind: 'wifi-roam',
        severity: 'info',
        message: `Wi-Fi switched channel to ${data.channel} (${data.band || ''})`,
        meta: { oldChannel: lastChannel, newChannel: data.channel, band: data.band },
      });
    }
    lastBssid = data.bssid || null;
    lastChannel = data.channel || null;
  }


  // Connect/disconnect edge detection + downtime accounting.
  if (!data.connected && alertState.connected) {
    alertState.connected = false;
    downtime.since = Date.now();
    await emitEvent({ kind: 'disconnect', severity: 'danger', message: 'Wi-Fi disconnected' });
  } else if (data.connected && !alertState.connected) {
    alertState.connected = true;
    if (downtime.since) {
      const ms = Date.now() - downtime.since;
      downtime.todayMs += ms;
      downtime.since = null;
      await emitEvent({
        kind: 'reconnect',
        severity: 'info',
        message: `Wi-Fi reconnected after ${Math.round(ms / 1000)}s down`,
        meta: { downMs: ms },
      });
    }
  }


  // Low-signal threshold (edge-triggered).
  if (data.rssi != null) {
    if (data.rssi < s.signalFloor && !alertState.signalLow) {
      alertState.signalLow = true;
      await emitEvent({
        kind: 'signal-low',
        severity: 'warning',
        message: `Signal dropped to ${data.rssi} dBm (below ${s.signalFloor})`,
        meta: { rssi: data.rssi, floor: s.signalFloor },
      });
    } else if (data.rssi >= s.signalFloor + 3 /* hysteresis */) {
      alertState.signalLow = false;
    }
  }
}

async function handleLatency(data) {
  latest.latency = data;
  broadcast('latency', data);
  const s = getSettings();

  if (data.latencyMs != null) {
    if (data.latencyMs > s.latencyCeiling && !alertState.latencyHigh) {
      alertState.latencyHigh = true;
      await emitEvent({
        kind: 'latency-high',
        severity: 'warning',
        message: `Latency spiked to ${Math.round(data.latencyMs)} ms (over ${s.latencyCeiling})`,
        meta: { latencyMs: data.latencyMs, ceiling: s.latencyCeiling },
      });
    } else if (data.latencyMs <= s.latencyCeiling * 0.8) {
      alertState.latencyHigh = false;
    }
  }

  if (data.packetLoss != null) {
    if (data.packetLoss > s.lossCeiling && !alertState.lossHigh) {
      alertState.lossHigh = true;
      await emitEvent({
        kind: 'loss-high',
        severity: 'danger',
        message: `Packet loss at ${data.packetLoss}% (over ${s.lossCeiling}%)`,
        meta: { loss: data.packetLoss, ceiling: s.lossCeiling },
      });
    } else if (data.packetLoss === 0) {
      alertState.lossHigh = false;
    }
  }
}

let devicesPrimed = false;

// Shared by any alert whose underlying condition can legitimately persist for
// a long time (a mesh AP rebroadcasting one SSID on several BSSIDs, a
// proxy-ARP device answering for several IPs, ...) so it doesn't re-fire every
// single poll cycle it's still true. `prune()` must be called periodically —
// without it, a long-running server accumulates one permanent entry per key
// it has ever seen, growing unbounded over weeks.
function createCooldown(windowMs) {
  const lastFiredAt = new Map(); // key -> timestamp
  return {
    tryFire(key) {
      const last = lastFiredAt.get(key);
      if (last && Date.now() - last < windowMs) return false;
      lastFiredAt.set(key, Date.now());
      return true;
    },
    prune() {
      const cutoff = Date.now() - windowMs;
      for (const [key, ts] of lastFiredAt) {
        if (ts < cutoff) lastFiredAt.delete(key);
      }
    },
  };
}

// US-20: some networks legitimately have one MAC answer for multiple IPs (mesh
// APs and proxy-ARP setups do this routinely), so "danger, right now" on every
// 45s scan would be constant false-alarm noise.
const ARP_WARNING_COOLDOWN_MS = 15 * 60 * 1000;
const arpWarningCooldown = createCooldown(ARP_WARNING_COOLDOWN_MS);

function arpWarningKey(w) {
  return w.type === 'mac-multiple-ips'
    ? `mac-multiple-ips:${w.mac}:${[...w.ips].sort().join(',')}`
    // Sort the two MACs so an IP flapping A->B->A->B cools down as one
    // recurring situation instead of two keys that alternate and never settle.
    : `ip-mac-conflict:${w.ip}:${[w.mac, w.previousMac].sort().join(',')}`;
}

// US-15: same reasoning — a home with 2+ APs/mesh nodes broadcasting one SSID
// on different BSSIDs for seamless roaming is a completely standard, common
// setup, not an anomaly, so this needs the same treatment as the ARP case
// above rather than firing "danger" on every Diagnostics page visit.
const ROGUE_AP_COOLDOWN_MS = 15 * 60 * 1000;
const rogueApCooldown = createCooldown(ROGUE_AP_COOLDOWN_MS);
const rogueApKey = (rogue) => `${rogue.ssid}:${rogue.bssid}`;

// US-23: sustained-high-throughput alerting for this host's own usage — see
// bandwidthTracker.js for why this can't be true per-LAN-device attribution.
const bandwidthHogTracker = createBandwidthHogTracker();

async function handleDevices(data) {
  latest.devices = data;
  broadcast('devices', data);
  // Skip the first scan's "new" flags — on a freshly-seeded DB everything looks
  // new. (recordSighting also returns isNew=false entirely when persistence off.)
  if (devicesPrimed) {
    for (const d of data.newlySeen ?? []) {
      await emitEvent({
        kind: 'new-device',
        severity: 'info',
        message: `New device joined: ${d.vendor || d.mac} (${d.ip})`,
        meta: d,
      });
    }
    // US-20: duplicate IP / one-MAC-many-IPs — a possible ARP-spoof signature,
    // but also a routine pattern on mesh/proxy-ARP networks, so it's a warning
    // to investigate rather than a confirmed attack.
    arpWarningCooldown.prune();
    for (const w of data.arpSpoofWarnings ?? []) {
      if (!arpWarningCooldown.tryFire(arpWarningKey(w))) continue;

      const others = w.otherClaimants?.length ? ` (and ${w.otherClaimants.length} more recently)` : '';
      const message =
        w.type === 'mac-multiple-ips'
          ? `MAC ${w.mac} is answering for multiple IPs (${w.ips.join(', ')}) — could be ARP spoofing, or a mesh/proxy-ARP device`
          : `IP ${w.ip} was claimed by ${w.previousMac}${others} moments ago, now by ${w.mac} — possible duplicate-IP / ARP spoofing`;
      await emitEvent({ kind: 'arp-spoof-warning', severity: 'warning', message, meta: w });
    }
  }
  devicesPrimed = true;
}

// Shared by the scheduled devices loop and the manual "rescan now" endpoint so
// they can never run concurrently — getLanDevices()'s duplicate-IP detection
// (US-20) reads a pre-scan snapshot and then writes sightings, an invariant
// that a second, overlapping scan could violate mid-flight.
async function runDeviceScan({ sweep }) {
  if (devicesScanning) return null;
  devicesScanning = true;
  try {
    const data = await getLanDevices({ sweep });
    await handleDevices(data);
    return data;
  } finally {
    devicesScanning = false;
  }
}

// --- Polling loops ---------------------------------------------------------
// Each loop is self-scheduling (setTimeout after completion) so a slow
// collector can't overlap-run itself. Interval is a function so cadence changes
// from Settings take effect on the next tick.

function loop(fn, intervalFn, label) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      await fn();
      logger.debug(`[${label}] tick ok`);
    } catch (err) {
      logger.error(`[${label}] collector error: ${err.message}`);
    }
    if (!stopped) setTimeout(tick, intervalFn());
  };
  tick();
  return () => {
    stopped = true;
  };
}

function startLoops() {
  loop(
    async () => {
      const data = await getThroughput();
      latest.throughput = data;
      broadcast('throughput', data);

      const s = getSettings();
      const totalMbps = ((data.rxSec ?? 0) + (data.txSec ?? 0)) * 8 / 1e6; // bytes/sec -> combined Mbps
      const hog = bandwidthHogTracker.check(totalMbps, {
        thresholdMbps: s.bandwidthHogMbps,
        sustainedMs: s.bandwidthHogMinutes * 60 * 1000,
      });
      if (hog) {
        await emitEvent({
          kind: 'bandwidth-hog',
          severity: 'warning',
          message: `This machine has sustained ${hog.totalMbps} Mbps combined throughput for over ${s.bandwidthHogMinutes} minutes`,
          meta: hog,
        });
      }
    },
    () => getSettings().throughputInterval,
    'throughput'
  );

  loop(async () => handleWifi(await getWifiStats()), () => getSettings().wifiInterval, 'wifi');
  loop(async () => handleLatency(await getLatency()), () => getSettings().latencyInterval, 'latency');
  loop(
    () => runDeviceScan({ sweep: true }),
    () => getSettings().devicesInterval,
    'devices'
  );

  // DNS timing, refreshed on its own cadence for the Diagnostics stat card.
  loop(
    async () => {
      latest.dns = await getDnsTiming();
      broadcast('dns', latest.dns);
    },
    () => DNS_INTERVAL,
    'dns'
  );

  // Persist a combined snapshot for the history charts, and prune old rows.
  loop(
    async () => {
      await insertSnapshot({
        rssi: latest.wifi?.rssi ?? null,
        rxSec: latest.throughput?.rxSec ?? null,
        txSec: latest.throughput?.txSec ?? null,
        latency: latest.latency?.latencyMs ?? null,
        loss: latest.latency?.packetLoss ?? null,
      });
      await pruneOld(getSettings().retentionHours);
      await pruneEvents(); // keep event log to a week
    },
    () => HISTORY_INTERVAL,
    'history'
  );
}

// Connect to MySQL (best-effort — runs without persistence if it fails), then
// start the poll loops and HTTP/WS server.
async function main() {
  await initDb();
  startLoops();
  server.listen(PORT, () => {
    logger.info(`WiFi dashboard backend on http://localhost:${PORT} (REST /api, WS /ws)`);
  });
}

main().catch((err) => {
  logger.error(`Fatal startup error: ${err.stack || err.message}`);
  process.exit(1);
});
