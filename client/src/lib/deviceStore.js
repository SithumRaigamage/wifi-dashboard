// deviceStore.js — client-side MAC → { name, tag } mapping in localStorage.
// The design spec keeps friendly names + tags local (not on the server), keyed
// by MAC so they survive IP changes.

const KEY = 'wifi-dashboard.devices';

export const TAGS = ['Work', 'Personal', 'IoT', 'Guest'];

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage full / disabled — names just won't persist */
  }
}

export function getDeviceMeta(mac) {
  return readAll()[mac] || { name: '', tag: '' };
}

export function setDeviceName(mac, name) {
  const all = readAll();
  all[mac] = { ...all[mac], name };
  writeAll(all);
  return all[mac];
}

// Cycle the tag pill through '' → Work → Personal → IoT → Guest → ''.
export function cycleDeviceTag(mac) {
  const all = readAll();
  const current = all[mac]?.tag || '';
  const idx = TAGS.indexOf(current);
  const next = idx === -1 || idx === TAGS.length - 1 ? '' : TAGS[idx + 1];
  all[mac] = { ...all[mac], tag: next };
  writeAll(all);
  return next;
}
