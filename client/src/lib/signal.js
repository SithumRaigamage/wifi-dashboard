// Shared signal-quality logic. Used by the header, the Signal metric card, and
// (by RTT analogue) the device list — one source of truth for thresholds.

// WiFi RSSI (dBm): >= -55 Strong, -55..-67 Fair, < -67 Weak.
export function rssiQuality(rssi) {
  if (rssi == null) return { key: 'unknown', label: 'Unknown', variant: 'muted' };
  if (rssi >= -55) return { key: 'strong', label: 'Strong', variant: 'success' };
  if (rssi >= -67) return { key: 'fair', label: 'Fair', variant: 'warning' };
  return { key: 'weak', label: 'Weak', variant: 'danger' };
}

// Backend already buckets device LAN RTT into strong/fair/weak/unknown; map to
// the same label/variant vocabulary as WiFi quality.
const QUALITY_META = {
  strong: { label: 'Strong', variant: 'success' },
  fair: { label: 'Fair', variant: 'warning' },
  weak: { label: 'Weak', variant: 'danger' },
  unknown: { label: 'No reply', variant: 'muted' },
};

export function qualityMeta(key) {
  return QUALITY_META[key] || QUALITY_META.unknown;
}

export function latencyVariant(ms) {
  if (ms == null) return 'muted';
  if (ms < 40) return 'success';
  if (ms < 100) return 'warning';
  return 'danger';
}
