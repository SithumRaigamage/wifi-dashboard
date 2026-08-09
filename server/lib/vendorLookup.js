// vendorLookup.js — resolve a MAC's manufacturer.
//
// Fast path is the bundled OUI table (offline, no network). When the online
// lookup setting is enabled, unknown OUIs are resolved against the free
// macvendors.com API and cached to server/vendor-cache.json so each OUI is only
// fetched once. Only the 3-octet OUI (manufacturer block) is ever sent — never a
// full address. Calls are throttled to respect the API's ~1 req/sec free tier.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { lookupVendor } from './ouiVendors.js';
import { scoped } from './logger.js';

const log = scoped('vendor');
const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, '..', 'vendor-cache.json');

const MIN_INTERVAL_MS = 1200; // macvendors free tier ≈ 1 req/sec
const NEG_TTL_MS = 7 * 24 * 60 * 60 * 1000; // re-try "unknown" OUIs after a week

// cache: oui -> { vendor: string|null, ts: number }
let cache = null;
let lastCallAt = 0;

function loadCache() {
  if (cache) return cache;
  cache = {};
  if (existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) || {};
    } catch {
      cache = {};
    }
  }
  return cache;
}

function persist() {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    /* cache is best-effort — losing it just means re-querying later */
  }
}

function ouiOf(mac) {
  if (!mac) return null;
  const clean = mac.replace(/[:\-.]/g, '').toUpperCase();
  return clean.length >= 6 ? clean.slice(0, 6) : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function queryApi(oui) {
  // Throttle so concurrent scans don't burst past the rate limit.
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
  try {
    const res = await fetch(`https://api.macvendors.com/${oui}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 404) return { vendor: null, cacheable: true };
    if (!res.ok) return { vendor: null, cacheable: false }; // 429/5xx — retry later
    const text = (await res.text()).trim();
    return { vendor: text || null, cacheable: true };
  } catch (err) {
    log.debug(`lookup failed for ${oui}: ${err.message}`);
    return { vendor: null, cacheable: false };
  }
}

// Resolve a vendor for a MAC. Returns a string or null. Hits the network only
// for OUIs not in the local table and not already cached (when `online` is true).
export async function resolveVendor(mac, { online = false } = {}) {
  const local = lookupVendor(mac);
  if (local) return local;
  if (!online) return null;

  const oui = ouiOf(mac);
  if (!oui) return null;

  const c = loadCache();
  const hit = c[oui];
  if (hit && (hit.vendor || Date.now() - hit.ts < NEG_TTL_MS)) {
    return hit.vendor;
  }

  const { vendor, cacheable } = await queryApi(oui);
  if (cacheable) {
    c[oui] = { vendor, ts: Date.now() };
    persist();
    if (vendor) log.debug(`resolved ${oui} → ${vendor}`);
  }
  return vendor;
}
