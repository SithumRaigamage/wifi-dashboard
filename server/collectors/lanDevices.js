// lanDevices.js — discover devices on the local subnet.
//
// nmap isn't required. We read the system ARP cache (`arp -a`), which lists
// hosts the machine has recently talked to. To make the list fuller we can
// first do a lightweight ping-sweep of the /24 so more hosts populate the
// cache. Reverse-DNS gives hostnames where available; vendor comes from a
// local OUI table.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import dns from 'node:dns/promises';
import os from 'node:os';
import { lookupVendor } from '../lib/ouiVendors.js';
import { resolveVendor } from '../lib/vendorLookup.js';
import { recordSighting, snapshotIpOwners, findIpMacConflict } from '../lib/devices.js';
import { classifyOs } from '../lib/osFingerprint.js';
import { classifyIot } from '../lib/iotClassifier.js';
import { getSettings } from '../lib/settings.js';

const execAsync = promisify(exec);

// Normalise a macOS arp MAC (which may drop leading zeros, e.g. "7:a5:35")
// into a canonical aa:bb:cc:dd:ee:ff form.
function normaliseMac(mac) {
  return mac
    .split(':')
    .map((o) => o.padStart(2, '0'))
    .join(':')
    .toLowerCase();
}

// A locally-administered ("randomized") MAC has bit 1 of the first octet set.
// Modern phones/laptops randomize their MAC per-network, so vendor lookup will
// (correctly) return null for these — flag them so the UI can say so.
function isRandomizedMac(mac) {
  const firstOctet = Number.parseInt(mac.slice(0, 2), 16);
  return Boolean(firstOctet & 0x02);
}

// Skip broadcast + IPv4 multicast (224.0.0.0/4) + link-local addresses; these
// aren't real devices, just ARP-cache noise.
function isRealHost(ip) {
  if (ip.endsWith('.255')) return false; // subnet broadcast
  const first = Number(ip.split('.')[0]);
  if (first >= 224) return false; // 224.0.0.0/4 multicast + reserved
  if (ip.startsWith('169.254.')) return false; // link-local
  return true;
}

// Find the IPv4 address + /24 base of the active LAN interface.
function getLocalSubnet(preferIface) {
  const ifaces = os.networkInterfaces();
  const order = preferIface ? [preferIface, ...Object.keys(ifaces)] : Object.keys(ifaces);
  for (const name of order) {
    for (const addr of ifaces[name] || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const base = addr.address.split('.').slice(0, 3).join('.');
        return { iface: name, address: addr.address, base };
      }
    }
  }
  return null;
}

// Fire off a burst of pings across the /24 to populate the ARP cache, and
// capture each host's round-trip time so the UI can show a per-device quality
// pill (there's no per-device WiFi RSSI without router access — LAN RTT is the
// honest, locally-measurable proxy).
async function pingSweep(base) {
  const rtt = new Map(); // ip -> ms
  const tasks = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${base}.${i}`;
    tasks.push(
      execAsync(`ping -c 1 -W 200 -t 1 ${ip}`, { timeout: 1500 })
        .then(({ stdout }) => {
          const m = /time[=<]([\d.]+)\s*ms/.exec(stdout);
          if (m) rtt.set(ip, Number(m[1]));
        })
        .catch(() => null)
    );
  }
  await Promise.allSettled(tasks);
  return rtt;
}

async function parseArpTable() {
  let stdout = '';
  try {
    ({ stdout } = await execAsync('arp -a -n', { timeout: 5000 }));
  } catch {
    try {
      ({ stdout } = await execAsync('arp -a', { timeout: 5000 }));
    } catch {
      return [];
    }
  }

  const devices = [];
  const seen = new Set();
  for (const line of stdout.split('\n')) {
    // e.g. "? (192.168.1.1) at 20:65:8e:fe:89:3b on en0 ifscope [ethernet]"
    const m = /^(\S+)?\s*\(([\d.]+)\)\s+at\s+([0-9a-fA-F:]+)\s+on\s+(\S+)/.exec(line);
    if (!m) continue;
    const [, hostField, ip, rawMac, iface] = m;
    if (/incomplete/i.test(rawMac)) continue;
    if (!isRealHost(ip)) continue;
    if (seen.has(ip)) continue;
    seen.add(ip);

    const mac = normaliseMac(rawMac);
    if (mac === 'ff:ff:ff:ff:ff:ff' || mac.startsWith('01:00:5e')) continue; // bcast/mcast
    devices.push({
      ip,
      mac,
      iface,
      hostname: hostField && hostField !== '?' ? hostField : null,
      vendor: lookupVendor(mac),
      randomizedMac: isRandomizedMac(mac),
    });
  }
  return devices;
}

// Best-effort reverse DNS for devices without a hostname from arp.
async function enrichHostnames(devices) {
  await Promise.allSettled(
    devices.map(async (d) => {
      if (d.hostname) return;
      try {
        const names = await dns.reverse(d.ip);
        if (names?.length) d.hostname = names[0];
      } catch {
        /* no PTR record — leave null */
      }
    })
  );
  return devices;
}

// US-20: one MAC replying for more than one IP in the *same* arp snapshot is
// the classic ARP-spoof/gateway-impersonation signature — a real NIC can't
// legitimately hold two LAN IPs at once.
function detectMacMultipleIps(devices) {
  const ipsByMac = new Map();
  for (const d of devices) {
    if (!ipsByMac.has(d.mac)) ipsByMac.set(d.mac, []);
    ipsByMac.get(d.mac).push(d.ip);
  }
  const warnings = [];
  for (const [mac, ips] of ipsByMac) {
    if (ips.length > 1) warnings.push({ type: 'mac-multiple-ips', mac, ips });
  }
  return warnings;
}

// LAN RTT (ms) -> quality bucket for the device pill.
function rttQuality(rtt) {
  if (rtt == null) return 'unknown';
  if (rtt < 10) return 'strong';
  if (rtt < 40) return 'fair';
  return 'weak';
}

// Fill in manufacturer names via the online OUI API (cached, throttled). Skips
// randomized MACs — they have no real vendor to resolve. Runs sequentially so a
// scan of new devices stays within the API rate limit.
async function enrichVendorsOnline(devices) {
  for (const d of devices) {
    if (d.vendor || d.randomizedMac) continue;
    d.vendor = await resolveVendor(d.mac, { online: true });
  }
  return devices;
}

export async function getLanDevices({ sweep = true, preferIface } = {}) {
  const subnet = getLocalSubnet(preferIface);
  let rtt = new Map();
  if (sweep && subnet) {
    rtt = await pingSweep(subnet.base);
  }
  const devices = await parseArpTable();
  const arpSpoofWarnings = detectMacMultipleIps(devices);

  // Snapshot who last owned each of this scan's IPs *before* recording any of
  // this scan's sightings below — so duplicate-IP detection always reflects
  // pre-scan state. Reading live mid-scan (or after writing) would make the
  // result depend on which device's own recordSighting() call happens to run
  // first, and could even erase the exact history a conflict check needs.
  const ipOwnerSnapshot = await snapshotIpOwners(devices.map((d) => d.ip));

  const newlySeen = [];
  for (const d of devices) {
    const ms = rtt.get(d.ip) ?? (d.ip === subnet?.address ? 0 : null);
    d.rttMs = ms;
    d.quality = rttQuality(ms);

    const sighting = await recordSighting(d.mac, d.ip);
    d.firstSeen = sighting.firstSeen;
    d.lastSeen = sighting.lastSeen;
    d.seenCount = sighting.seenCount;
    if (sighting.isNew) newlySeen.push({ mac: d.mac, ip: d.ip, vendor: d.vendor });

    const conflict = findIpMacConflict(d.ip, d.mac, ipOwnerSnapshot);
    if (conflict) arpSpoofWarnings.push({ type: 'ip-mac-conflict', ip: d.ip, mac: d.mac, ...conflict });
  }

  // Sort by numeric IP for a stable, readable table.
  devices.sort((a, b) => {
    const na = a.ip.split('.').map(Number);
    const nb = b.ip.split('.').map(Number);
    for (let i = 0; i < 4; i++) if (na[i] !== nb[i]) return na[i] - nb[i];
    return 0;
  });

  await enrichHostnames(devices);
  if (getSettings().onlineVendorLookup) await enrichVendorsOnline(devices);

  // US-21: best-effort OS guess, run last so it sees the fully-enriched
  // hostname/vendor rather than the raw arp-table fields. Destructured as
  // osGuess (not os) — this file imports node:os for getLocalSubnet(), and
  // shadowing it here would be a landmine for a future edit.
  for (const d of devices) {
    const { os: osGuess, confidence } = classifyOs(d);
    d.os = osGuess;
    d.osConfidence = confidence;
    // US-22: same enriched hostname/vendor, cheap to classify alongside OS.
    d.isIot = classifyIot(d);
  }

  return {
    subnet: subnet?.base ? `${subnet.base}.0/24` : null,
    selfIp: subnet?.address || null,
    count: devices.length,
    devices,
    newlySeen, // MACs seen for the first time this scan (for the new-device alert)
    arpSpoofWarnings, // duplicate-IP / one-MAC-many-IPs signals (for the arp-spoof alert)
  };
}
