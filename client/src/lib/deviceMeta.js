// deviceMeta.js — shared device icon + display-name logic, used by the Overview
// recent-devices preview and the full Devices section so both label a device the
// same way. A locally-saved friendly name (from deviceStore) always wins.

import { Router, Laptop, Smartphone, HardDrive, Apple, AppWindow, Terminal, Tv } from 'lucide-react';

// US-21: icon by best-effort OS guess when we have one (any confidence — the
// icon is a soft hint, not a claim; osConfidence is what drives the label).
const OS_ICON = { iOS: Apple, macOS: Laptop, Windows: AppWindow, Android: Smartphone, Linux: Terminal, Tizen: Tv };

export function deviceIcon(d, isSelf, isGateway) {
  if (isGateway) return Router;
  if (isSelf) return Laptop;
  if (d.os && OS_ICON[d.os]) return OS_ICON[d.os];
  if (d.randomizedMac) return Smartphone; // randomized MAC → likely a phone/laptop
  return HardDrive;
}

// Fallback name when the user hasn't set a custom one.
export function autoName(d, isSelf, isGateway) {
  if (d.hostname) return d.hostname.replace(/\.local\.?$/, '');
  if (isGateway) return 'Gateway';
  if (isSelf) return 'This Mac';
  return d.vendor || 'Unknown device';
}

export function isGatewayIp(ip) {
  return typeof ip === 'string' && ip.endsWith('.1');
}

// US-21: one place for the OS label + tooltip so the card row and table view
// can't drift out of sync on how a guess is presented.
export function formatOs(d) {
  if (!d.os) return null;
  const label = d.osConfidence === 'low' ? `${d.os}?` : d.os;
  const title = d.osConfidence === 'low' ? 'Guessed from vendor only — low confidence' : 'Guessed from hostname';
  return { label, title };
}
