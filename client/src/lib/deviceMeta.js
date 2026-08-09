// deviceMeta.js — shared device icon + display-name logic, used by the Overview
// recent-devices preview and the full Devices section so both label a device the
// same way. A locally-saved friendly name (from deviceStore) always wins.

import { Router, Laptop, Smartphone, HardDrive } from 'lucide-react';

export function deviceIcon(d, isSelf, isGateway) {
  if (isGateway) return Router;
  if (isSelf) return Laptop;
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
