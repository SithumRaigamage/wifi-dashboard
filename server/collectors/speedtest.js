// speedtest.js — lightweight internet speed test via Cloudflare's speed
// endpoints. No external binary or account needed (unlike Ookla/speedtest-net).
//
//   download: GET  https://speed.cloudflare.com/__down?bytes=N
//   upload:   POST https://speed.cloudflare.com/__up   (body of N bytes)
//   ping:     time-to-first-byte of a tiny download
//
// Uses Node's global fetch (Node 18+).

const DOWN_URL = 'https://speed.cloudflare.com/__down';
const UP_URL = 'https://speed.cloudflare.com/__up';

async function measureDownload(bytes) {
  const start = performance.now();
  const res = await fetch(`${DOWN_URL}?bytes=${bytes}`, { cache: 'no-store' });
  const buf = await res.arrayBuffer();
  const secs = (performance.now() - start) / 1000;
  const mbps = (buf.byteLength * 8) / secs / 1e6;
  return { mbps, secs };
}

async function measureUpload(bytes) {
  const payload = Buffer.alloc(bytes, 0x61); // 'a'
  const start = performance.now();
  await fetch(UP_URL, {
    method: 'POST',
    body: payload,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  const secs = (performance.now() - start) / 1000;
  const mbps = (bytes * 8) / secs / 1e6;
  return { mbps, secs };
}

async function measurePing(samples = 4) {
  const times = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    // Smallest possible download; TTFB dominates → approximates RTT.
    const res = await fetch(`${DOWN_URL}?bytes=0`, { cache: 'no-store' });
    await res.arrayBuffer();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]; // median
}

// Ramp the payload size up so slow links don't wait on a huge transfer and fast
// links still get a meaningful sample. Returns the best (largest-sample) rate.
async function rampedMeasure(fn, sizes) {
  let best = 0;
  for (const size of sizes) {
    try {
      const { mbps, secs } = await fn(size);
      best = mbps;
      // If a single transfer already took a while, we have enough signal.
      if (secs > 3) break;
    } catch {
      break;
    }
  }
  return best;
}

export async function runSpeedTest() {
  const ping = await measurePing();
  const download = await rampedMeasure(measureDownload, [1e6, 1e7, 2.5e7]);
  const upload = await rampedMeasure(measureUpload, [5e5, 2e6, 5e6]);
  return {
    download: Number(download.toFixed(2)), // Mbps
    upload: Number(upload.toFixed(2)), // Mbps
    ping: Number(ping.toFixed(1)), // ms
    ts: new Date().toISOString(),
  };
}
