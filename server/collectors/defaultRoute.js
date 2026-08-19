// defaultRoute.js — cached `route -n get default` parse, shared by anything
// that needs to know the active network interface or gateway. Previously
// wifiStats.js and routerScanner.js each independently shelled out to this
// same command and parsed a different capture group out of the same output.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Bounded, not permanent: getWifiInterface() is called on every throughput
// tick (every ~2s by default), so *some* caching avoids spawning `route` that
// often — but caching forever has two real failure modes: (1) the very first
// call can happen at process boot before the network is even up, and a
// permanently-cached failure would 503 the router-scan endpoint for the rest
// of the process's life; (2) the gateway genuinely changes when the Mac
// switches networks, and a permanent cache would silently keep scanning the
// old router. A successful lookup is cached for SUCCESS_TTL_MS; a failed one
// is retried after just FAILURE_RETRY_MS, not immediately — a sustained
// outage (Wi-Fi drop, sleep/wake) would otherwise re-exec `route` on every
// single 2s tick, potentially spawning overlapping subprocesses before the
// previous attempt's own timeout even elapses.
const SUCCESS_TTL_MS = 5 * 60 * 1000;
const FAILURE_RETRY_MS = 10 * 1000;
let cached = null;
let cachedAt = 0;
let lastAttemptFailed = false;
let inFlight = null; // shared promise so concurrent cold callers don't each spawn their own `route`

export async function getDefaultRoute() {
  const now = Date.now();
  const ttl = lastAttemptFailed ? FAILURE_RETRY_MS : SUCCESS_TTL_MS;
  if (cached && now - cachedAt < ttl) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { stdout } = await execAsync('route -n get default', { timeout: 3000 });
      const ifaceMatch = stdout.match(/interface:\s*(\S+)/);
      const gatewayMatch = stdout.match(/gateway:\s*([\d.]+)/);
      cached = {
        iface: ifaceMatch ? ifaceMatch[1] : 'en0',
        gateway: gatewayMatch ? gatewayMatch[1] : null,
      };
      // A gateway-less "success" (exec didn't error, but stdout didn't have
      // the line we need — a transitional link state, an unusual default
      // route type, ...) is still missing the one thing routerScanner.js
      // needs, so it gets the short retry window too, not the 5-minute one.
      lastAttemptFailed = gatewayMatch == null;
    } catch {
      // Keep serving the last known-good value across a transient failure
      // (better than reporting "no gateway" over one hiccup) rather than
      // overwriting it; only fall back to defaults if nothing has ever
      // resolved successfully.
      if (!cached) cached = { iface: 'en0', gateway: null };
      lastAttemptFailed = true;
    } finally {
      cachedAt = Date.now();
      inFlight = null;
    }
    return cached;
  })();

  return inFlight;
}
