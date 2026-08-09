// history.js — MySQL time-series store for network snapshots.
//
// Two tiers (per the "longer retention + downsampling" design):
//   snapshots — one row per poll cycle, kept for `retentionHours` (raw, ~24h).
//               Backs the 1h/24h usage charts.
//   hourly    — rolled-up hourly averages, kept far longer. Backs the
//               day-of-week × hour-of-day heatmap and the daily summary.
//
// All functions are async; they no-op / return empty when the DB is unavailable.

import { query, execute } from './db.js';

const HOUR_MS = 60 * 60 * 1000;

// Incremental hourly rollup: fold each new sample into the current hour's
// running average so the heatmap accumulates over days without re-scanning.
async function foldHourly(sample) {
  const hour = Math.floor(sample.ts / HOUR_MS) * HOUR_MS;
  const rows = await query('SELECT * FROM hourly WHERE hour = ?', [hour]);
  const prev = rows[0] || null;
  const n = prev ? prev.samples : 0;
  const mean = (prevVal, val) => {
    if (val == null) return prevVal ?? null;
    if (prevVal == null) return val;
    return (prevVal * n + val) / (n + 1);
  };
  await execute(
    `INSERT INTO hourly (hour, rssi, rx_sec, tx_sec, latency, loss, samples)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rssi=VALUES(rssi), rx_sec=VALUES(rx_sec), tx_sec=VALUES(tx_sec),
       latency=VALUES(latency), loss=VALUES(loss), samples=VALUES(samples)`,
    [
      hour,
      mean(prev?.rssi, sample.rssi),
      mean(prev?.rx_sec, sample.rx_sec),
      mean(prev?.tx_sec, sample.tx_sec),
      mean(prev?.latency, sample.latency),
      mean(prev?.loss, sample.loss),
      n + 1,
    ]
  );
}

export async function insertSnapshot({ rssi, rxSec, txSec, latency, loss }) {
  const row = {
    ts: Date.now(),
    rssi: rssi ?? null,
    rx_sec: rxSec ?? null,
    tx_sec: txSec ?? null,
    latency: latency ?? null,
    loss: loss ?? null,
  };
  await execute(
    `INSERT INTO snapshots (ts, rssi, rx_sec, tx_sec, latency, loss)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rssi=VALUES(rssi), rx_sec=VALUES(rx_sec), tx_sec=VALUES(tx_sec),
       latency=VALUES(latency), loss=VALUES(loss)`,
    [row.ts, row.rssi, row.rx_sec, row.tx_sec, row.latency, row.loss]
  );
  await foldHourly(row);
}

export async function pruneOld(retentionHours = 24) {
  await execute('DELETE FROM snapshots WHERE ts < ?', [Date.now() - retentionHours * HOUR_MS]);
}

// Downsampled to ~maxPoints buckets so charts stay light regardless of row count.
export async function getHistory(range = '1h', maxPoints = 120) {
  const rangeMs = range === '24h' ? 24 * HOUR_MS : HOUR_MS;
  const since = Date.now() - rangeMs;
  const rows = await query('SELECT * FROM snapshots WHERE ts >= ? ORDER BY ts ASC', [since]);

  if (rows.length <= maxPoints) return rows.map(toPoint);

  const bucketMs = rangeMs / maxPoints;
  const buckets = new Map();
  for (const r of rows) {
    const key = Math.floor((r.ts - since) / bucketMs);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }
  const avg = (arr, f) => {
    const vals = arr.map(f).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  return [...buckets.values()].map((group) => ({
    t: Math.round(avg(group, (r) => r.ts)),
    rssi: avg(group, (r) => r.rssi),
    rx: avg(group, (r) => r.rx_sec),
    tx: avg(group, (r) => r.tx_sec),
    latency: avg(group, (r) => r.latency),
    loss: avg(group, (r) => r.loss),
  }));
}

// 7 (day of week) × 24 (hour) grid of average latency from the hourly rollups.
export async function getHeatmap() {
  const rows = await query('SELECT * FROM hourly', []);
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }))
  );
  for (const r of rows) {
    if (r.latency == null) continue;
    const d = new Date(Number(r.hour));
    const cell = grid[d.getDay()][d.getHours()];
    cell.sum += r.latency;
    cell.n += 1;
  }
  return grid.map((row) => row.map((c) => (c.n ? Math.round(c.sum / c.n) : null)));
}

// Recap over the last `hours`: averages, worst latency spike, busiest hour.
export async function getSummary(hours = 24) {
  const since = Date.now() - hours * HOUR_MS;
  const rows = await query('SELECT * FROM hourly WHERE hour >= ? ORDER BY hour ASC', [since]);
  if (!rows.length) return null;

  const avgOf = (f) => {
    const v = rows.map(f).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  let worstLatency = null;
  let busiest = null;
  for (const r of rows) {
    if (r.latency != null && (worstLatency == null || r.latency > worstLatency.latency)) {
      worstLatency = { hour: Number(r.hour), latency: r.latency };
    }
    const total = (r.rx_sec ?? 0) + (r.tx_sec ?? 0);
    if (busiest == null || total > busiest.total) busiest = { hour: Number(r.hour), total };
  }
  return {
    hours,
    avgDownMbps: mbps(avgOf((r) => r.rx_sec)),
    avgUpMbps: mbps(avgOf((r) => r.tx_sec)),
    avgLatencyMs: round(avgOf((r) => r.latency)),
    avgLossPct: round(avgOf((r) => r.loss)),
    worstLatency: worstLatency ? { hour: worstLatency.hour, latencyMs: round(worstLatency.latency) } : null,
    busiestHour: busiest ? { hour: busiest.hour, mbps: mbps(busiest.total) } : null,
  };
}

// Flat rows for CSV export of a range (raw snapshots).
export async function exportRows(range = '24h') {
  const rangeMs = range === '24h' ? 24 * HOUR_MS : HOUR_MS;
  const since = Date.now() - rangeMs;
  return query('SELECT * FROM snapshots WHERE ts >= ? ORDER BY ts ASC', [since]);
}

function toPoint(r) {
  return { t: Number(r.ts), rssi: r.rssi, rx: r.rx_sec, tx: r.tx_sec, latency: r.latency, loss: r.loss };
}
function mbps(bytesPerSec) {
  return bytesPerSec == null ? null : round((bytesPerSec * 8) / 1e6);
}
function round(v) {
  return v == null ? null : Math.round(v * 10) / 10;
}
