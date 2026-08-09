// traceroute.js — on-demand traceroute to a target, parsed into a hop list.
// Wraps the system `traceroute` binary (present on macOS, no sudo). The target
// is validated to a hostname/IP so the argument can't be used for injection.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Allow letters, digits, dots, hyphens, colons (IPv6). Nothing shell-special.
const VALID = /^[a-zA-Z0-9.\-:]+$/;

function parseHops(raw) {
  const hops = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const num = Number(m[1]);
    const rest = m[2].trim();
    if (rest.startsWith('* * *') || /^\*/.test(rest)) {
      hops.push({ hop: num, host: null, ip: null, ms: null, timeout: true });
      continue;
    }
    // e.g. "router.local (192.168.1.1)  1.234 ms  1.111 ms  1.050 ms"
    const hostM = rest.match(/^([^\s(]+)\s*(?:\(([^)]+)\))?/);
    const times = [...rest.matchAll(/([\d.]+)\s*ms/g)].map((x) => Number(x[1]));
    const host = hostM ? hostM[1] : null;
    const ip = hostM && hostM[2] ? hostM[2] : /^[\d.]+$/.test(host) ? host : null;
    const ms = times.length ? Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)) : null;
    hops.push({ hop: num, host, ip, ms, timeout: false });
  }
  return hops;
}

export async function runTraceroute(target) {
  if (!target || !VALID.test(target)) {
    throw new Error('invalid target');
  }
  // -n omitted so we get hostnames; -w 1 (1s wait), -q 3 (3 probes), -m 20 hops.
  const { stdout } = await execFileAsync(
    'traceroute',
    ['-w', '1', '-q', '3', '-m', '20', target],
    { timeout: 40000, maxBuffer: 1024 * 1024 }
  );
  return { target, hops: parseHops(stdout), ts: new Date().toISOString() };
}
