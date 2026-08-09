// devices.js — persistent per-MAC device history (first seen / last seen /
// count), MySQL-backed. Feeds the Devices section timestamps and the
// "new device" alert. Friendly names + tags live client-side (localStorage).
// Async; degrades to "always new / empty" when the DB is unavailable.

import { query, execute, isDbReady } from './db.js';

// Record a sighting. Returns { firstSeen, lastSeen, seenCount, isNew }.
export async function recordSighting(mac, ip) {
  const now = Date.now();
  // Without persistence we can't tell new from returning devices — never flag
  // "new" (avoids spamming new-device alerts every scan when the DB is off).
  if (!isDbReady()) return { firstSeen: now, lastSeen: now, seenCount: 1, isNew: false };
  const rows = await query('SELECT * FROM device_history WHERE mac = ?', [mac]);
  const existing = rows[0];
  if (!existing) {
    await execute(
      'INSERT INTO device_history (mac, first_seen, last_seen, last_ip, seen_count) VALUES (?, ?, ?, ?, 1)',
      [mac, now, now, ip ?? null]
    );
    return { firstSeen: now, lastSeen: now, seenCount: 1, isNew: true };
  }
  await execute(
    'UPDATE device_history SET last_seen = ?, last_ip = ?, seen_count = seen_count + 1 WHERE mac = ?',
    [now, ip ?? existing.last_ip, mac]
  );
  return {
    firstSeen: Number(existing.first_seen),
    lastSeen: now,
    seenCount: existing.seen_count + 1,
    isNew: false,
  };
}

export async function allDeviceHistory() {
  const rows = await query('SELECT * FROM device_history', []);
  const map = new Map();
  for (const r of rows) {
    map.set(r.mac, {
      firstSeen: Number(r.first_seen),
      lastSeen: Number(r.last_seen),
      lastIp: r.last_ip,
      seenCount: r.seen_count,
    });
  }
  return map;
}
