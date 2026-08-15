// portScanner.js — on-demand TCP port check for a single LAN device.
//
// Not a general-purpose scanner: the target must be a private (RFC1918) or
// loopback IPv4 address, so this can only be pointed at the user's own LAN,
// never used as an open proxy to probe arbitrary internet hosts.

import net from 'node:net';

// Ports called out in US-19: SSH, HTTP, HTTPS, SMB, HTTP-alt.
const DEFAULT_PORTS = [
  { port: 22, service: 'SSH' },
  { port: 80, service: 'HTTP' },
  { port: 443, service: 'HTTPS' },
  { port: 445, service: 'SMB' },
  { port: 8080, service: 'HTTP-alt' },
];

const CONNECT_TIMEOUT_MS = 800;

const PRIVATE_IPV4 = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
];

export function isPrivateIPv4(ip) {
  return typeof ip === 'string' && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && PRIVATE_IPV4.some((re) => re.test(ip));
}

function checkPort(ip, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ open, ms: open ? Date.now() - start : null });
    };

    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, ip);
  });
}

export async function scanPorts(ip, ports = DEFAULT_PORTS) {
  if (!isPrivateIPv4(ip)) {
    throw new Error('target must be a private LAN IPv4 address');
  }

  const results = await Promise.all(
    ports.map(async ({ port, service }) => {
      const { open, ms } = await checkPort(ip, port);
      return { port, service, open, ms };
    })
  );

  return {
    ip,
    scannedAt: new Date().toISOString(),
    ports: results,
    openCount: results.filter((r) => r.open).length,
  };
}
