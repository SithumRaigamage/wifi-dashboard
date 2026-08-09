// dns.js — DNS resolution timing, separated from raw ping latency.
// A slow DNS lookup with fast ping points at the resolver, not the link.
// Uses a fresh Resolver per call so we time an uncached lookup where possible.

import { Resolver } from 'node:dns/promises';

const DEFAULT_NAMES = ['cloudflare.com', 'google.com', 'wikipedia.org'];

async function timeLookup(name) {
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  const start = performance.now();
  try {
    await resolver.resolve4(name);
    return performance.now() - start;
  } catch {
    return null;
  }
}

export async function getDnsTiming(names = DEFAULT_NAMES) {
  const results = await Promise.all(
    names.map(async (name) => ({ name, ms: await timeLookup(name) }))
  );
  const ok = results.filter((r) => r.ms != null);
  const avg = ok.length ? ok.reduce((a, r) => a + r.ms, 0) / ok.length : null;
  return {
    avgMs: avg != null ? Number(avg.toFixed(1)) : null,
    resolved: ok.length,
    total: names.length,
    samples: results.map((r) => ({ name: r.name, ms: r.ms != null ? Number(r.ms.toFixed(1)) : null })),
  };
}
