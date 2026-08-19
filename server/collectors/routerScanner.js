// routerScanner.js — US-25: check whether the LAN gateway's admin portal is
// reachable over plain HTTP with no HTTPS available — a common but risky
// default on consumer routers, since anything on the LAN (or anyone who gets
// onto it) can then see admin-panel traffic, including a login form, in
// plaintext.
//
// A HEAD request (not just a TCP connect, which portScanner.js already does)
// confirms there's an actual HTTP server answering, not just an open port.

import http from 'node:http';
import https from 'node:https';
import { isPrivateIPv4 } from './portScanner.js';
import { getDefaultRoute } from './defaultRoute.js';

const REQUEST_TIMEOUT_MS = 3000;

// Resolves the gateway server-side rather than accepting a client-supplied
// IP — this endpoint is specifically "scan my own router," not a general
// scan-anything primitive, so there's no reason to trust the caller's idea
// of what the gateway is.
export async function getDefaultGatewayIp() {
  return (await getDefaultRoute()).gateway;
}

function headRequest(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https:') ? https : http;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const req = mod.request(
      url,
      { method: 'HEAD', timeout: REQUEST_TIMEOUT_MS, rejectUnauthorized: false },
      (res) => {
        res.resume(); // drain, we don't need the body
        finish({ reachable: true, statusCode: res.statusCode, server: res.headers.server || null });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      finish({ reachable: false });
    });
    req.on('error', () => finish({ reachable: false }));
    req.end();
  });
}

export async function scanRouterAdminPortal(gatewayIp) {
  if (!isPrivateIPv4(gatewayIp)) {
    throw new Error('gateway must be a private LAN IPv4 address');
  }

  const [httpResult, httpsResult] = await Promise.all([
    headRequest(`http://${gatewayIp}/`),
    headRequest(`https://${gatewayIp}/`),
  ]);

  const httpOpen = httpResult.reachable;
  const httpsOpen = httpsResult.reachable;

  return {
    gatewayIp,
    scannedAt: new Date().toISOString(),
    httpOpen,
    httpsOpen,
    httpServer: httpResult.server,
    httpsServer: httpsResult.server,
    // Only worth a recommendation when we've confirmed HTTP works and HTTPS
    // genuinely doesn't — an HTTP redirect *to* HTTPS still counts as "has
    // HTTPS," so this isn't flagging routers that already do the right thing.
    recommendation:
      httpOpen && !httpsOpen
        ? 'Router admin portal is reachable over unencrypted HTTP only. If your router supports HTTPS admin access, enable it — otherwise admin login traffic on your LAN is in plaintext.'
        : null,
  };
}
