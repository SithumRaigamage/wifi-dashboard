// settings.js — JSON-file-backed runtime settings.
// Backs the Settings section and feeds the collectors / event thresholds.
// Kept deliberately simple (single-machine dashboard): one JSON file, synchronous
// read/write, an in-memory copy that the rest of the server reads live.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scoped } from './logger.js';

const log = scoped('settings');

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'settings.json');

export const DEFAULTS = {
  // Poll cadences (ms). Loops read these live on each tick.
  throughputInterval: 2000,
  wifiInterval: 5000,
  latencyInterval: 3000,
  devicesInterval: 45000,

  pingHost: process.env.PING_HOST || '1.1.1.1',
  retentionHours: 24, // raw snapshot retention; hourly rollups kept longer

  // Resolve unknown device manufacturers via the macvendors.com API (cached).
  // Off by default since it makes outbound network calls.
  onlineVendorLookup: false,

  // Alert thresholds.
  signalFloor: -70, // dBm; below this → signal-low event
  latencyCeiling: 150, // ms; above this → latency-high event
  lossCeiling: 20, // %; above this → packet-loss event
  bandwidthHogMbps: 50, // sustained combined up+down above this → bandwidth-hog event
  bandwidthHogMinutes: 15, // how long it has to stay above bandwidthHogMbps first

  // Integrations / modes.
  publicStatus: false, // expose /api/status/public read-only summary
  pushAlerts: false, // POST critical events to the webhook below
  webhookUrl: '', // Slack/Discord-compatible incoming webhook

  // Email alerts (SMTP). Password is NOT stored here — set SMTP_PASS in .env.
  emailAlerts: false, // send email on warning/danger events
  smtpHost: '', // e.g. smtp.gmail.com
  smtpPort: 587, // 587 (STARTTLS) or 465 (SSL)
  smtpSecure: false, // true for port 465
  smtpUser: '', // SMTP username (often the from address)
  emailFrom: '', // From header (defaults to smtpUser)
  emailTo: '', // recipient
};

let current = { ...DEFAULTS };

function load() {
  if (existsSync(FILE)) {
    try {
      const raw = JSON.parse(readFileSync(FILE, 'utf8'));
      current = { ...DEFAULTS, ...raw };
    } catch {
      current = { ...DEFAULTS };
    }
  }
}
load();

export function getSettings() {
  return { ...current };
}

// Merge + persist only known keys (ignore anything the client makes up).
export function updateSettings(patch = {}) {
  const next = { ...current };
  for (const key of Object.keys(DEFAULTS)) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  current = next;
  try {
    writeFileSync(FILE, JSON.stringify(current, null, 2));
    log.info('settings updated', { keys: Object.keys(patch) });
  } catch (err) {
    log.error(`write failed: ${err.message}`);
  }
  return { ...current };
}
