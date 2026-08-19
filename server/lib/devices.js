// devices.js — persistent per-MAC device history (first seen / last seen /
// count), MySQL-backed. Feeds the Devices section timestamps and the
// "new device" alert. Friendly names + tags live client-side (localStorage).
// Async; degrades to "always new / empty" when the DB is unavailable.

import { query, execute, isDbReady } from './db.js';

// US-20: how recent another device's last-known sighting at this IP has to be
// for a MAC change on that IP to count as a live conflict rather than just a
// stale DHCP lease that moved on naturally after the old device left.
const IP_CONFLICT_WINDOW_MS = 10 * 60 * 1000;

// Snapshot who device_history currently says last owned each of these IPs —
// call this once, *before* recording this scan's sightings. Conflict checks
// then read from the snapshot instead of live-querying mid-scan, so the result
// reflects pre-scan state and can't depend on which device happens to get its
// own recordSighting() call first (which would otherwise let one device's own
// update erase the very history a sibling device's conflict check needed).
export async function snapshotIpOwners(ips) {
  const byIp = new Map();
  const uniqueIps = [...new Set(ips)].filter(Boolean);
  if (!isDbReady() || !uniqueIps.length) return byIp;
  const placeholders = uniqueIps.map(() => '?').join(',');
  const rows = await query(`SELECT mac, last_ip, last_seen FROM device_history WHERE last_ip IN (${placeholders})`, uniqueIps);
  for (const r of rows) {
    if (!byIp.has(r.last_ip)) byIp.set(r.last_ip, []);
    byIp.get(r.last_ip).push({ mac: r.mac, lastSeen: Number(r.last_seen) });
  }
  return byIp;
}

// Given a pre-scan snapshot (from snapshotIpOwners), was this ip:mac pair
// actively claimed by some *other* MAC very recently? A positive result is a
// duplicate-IP / possible ARP-spoof signal. The message narrates the single
// most recently active other owner, but `otherClaimants` keeps every qualifying
// MAC (for the rarer 3+-way collision) so nothing is silently dropped from the
// stored event's meta, even though only one name makes the human-readable text.
export function findIpMacConflict(ip, mac, snapshot) {
  const owners = (snapshot.get(ip) || []).filter(
    (o) => o.mac !== mac && Date.now() - o.lastSeen < IP_CONFLICT_WINDOW_MS
  );
  if (!owners.length) return null;
  const sorted = [...owners].sort((a, b) => b.lastSeen - a.lastSeen);
  const [mostRecent, ...rest] = sorted;
  return {
    previousMac: mostRecent.mac,
    lastSeen: mostRecent.lastSeen,
    otherClaimants: rest.map((o) => o.mac),
  };
}

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
