// events.js — chronological event log backing the Alerts section (MySQL).
// Detects/stores disconnects, reconnects, new devices and threshold breaches.
// Async; no-ops / returns empty when the DB is unavailable.

import { query, execute } from './db.js';

export async function logEvent({ kind, severity = 'info', message, meta = null }) {
  const ts = Date.now();
  const metaJson = meta ? JSON.stringify(meta) : null;
  const res = await execute(
    'INSERT INTO events (ts, kind, severity, message, meta) VALUES (?, ?, ?, ?, ?)',
    [ts, kind, severity, message, metaJson]
  );
  return { id: res.insertId || undefined, ts, kind, severity, message, meta };
}

export async function listEvents(limit = 100) {
  const n = Math.max(1, Math.min(Number(limit) || 100, 500));
  // LIMIT can't be a bound param in a prepared statement on some MySQL versions;
  // n is sanitised to an integer above, so interpolating it is safe.
  const rows = await query(`SELECT * FROM events ORDER BY ts DESC LIMIT ${n}`, []);
  return rows.map(deserialise);
}

export async function eventsSince(ts) {
  const rows = await query('SELECT * FROM events WHERE ts >= ? ORDER BY ts DESC', [ts]);
  return rows.map(deserialise);
}

export async function pruneEvents(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  await execute('DELETE FROM events WHERE ts < ?', [Date.now() - maxAgeMs]);
}

function deserialise(r) {
  // mysql2 returns JSON columns already parsed; tolerate a raw string too.
  let meta = r.meta ?? null;
  if (typeof meta === 'string') meta = safeParse(meta);
  return {
    id: Number(r.id),
    ts: Number(r.ts),
    kind: r.kind,
    severity: r.severity,
    message: r.message,
    meta,
  };
}
function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
