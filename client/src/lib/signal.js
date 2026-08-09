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

/**
 * Calculates a composite 0-100 Wi-Fi Health Score and breakdown components.
 */
export function calculateHealthScore(live = {}) {
  const rssi = live.wifi?.rssi;
  const latency = live.latency?.latencyMs;
  const jitter = live.latency?.jitterMs ?? 0;
  const loss = live.latency?.packetLoss ?? 0;
  const txRate = live.wifi?.txRate;

  // 1. Signal Sub-Score (35%)
  let signalScore = 75; // default fallback if unreadable/eth
  if (rssi != null) {
    if (rssi >= -55) signalScore = 100;
    else if (rssi <= -85) signalScore = 20;
    else signalScore = Math.round(100 - (( -55 - rssi) / 30) * 80);
  }

  // 2. Latency Sub-Score (30%)
  let latencyScore = 80;
  if (latency != null) {
    if (latency <= 15) latencyScore = 100;
    else if (latency >= 120) latencyScore = 20;
    else latencyScore = Math.round(100 - ((latency - 15) / 105) * 80);
  }

  // 3. Stability & Jitter Sub-Score (25%)
  let jitterScore = 100;
  if (jitter > 2) {
    jitterScore = Math.max(10, Math.round(100 - ((jitter - 2) / 18) * 80));
  }
  let lossScore = Math.max(0, 100 - loss * 5);
  const stabilityScore = Math.round(jitterScore * 0.6 + lossScore * 0.4);

  // 4. Link Rate Sub-Score (10%)
  let linkScore = 80;
  if (txRate != null && txRate > 0) {
    if (txRate >= 600) linkScore = 100;
    else if (txRate >= 150) linkScore = 80;
    else linkScore = 50;
  }

  // Composite score calculation
  const total = Math.round(
    signalScore * 0.35 +
    latencyScore * 0.30 +
    stabilityScore * 0.25 +
    linkScore * 0.10
  );

  const clamped = Math.max(0, Math.min(100, total));

  let level = 'excellent';
  let label = 'Excellent';
  let variant = 'success';
  let color = '#10b981'; // emerald-500

  if (clamped < 60) {
    level = 'degraded';
    label = 'Degraded';
    variant = 'danger';
    color = '#f43f5e'; // rose-500
  } else if (clamped < 75) {
    level = 'fair';
    label = 'Fair';
    variant = 'warning';
    color = '#f59e0b'; // amber-500
  } else if (clamped < 88) {
    level = 'good';
    label = 'Good';
    variant = 'info';
    color = '#3b82f6'; // blue-500
  }

  return {
    score: clamped,
    level,
    label,
    variant,
    color,
    breakdown: {
      signal: { score: signalScore, label: rssi != null ? `${rssi} dBm` : 'N/A' },
      latency: { score: latencyScore, label: latency != null ? `${Math.round(latency)} ms` : 'N/A' },
      stability: { score: stabilityScore, label: `${jitter} ms jitter / ${loss}% loss` },
      speed: { score: linkScore, label: txRate != null ? `${txRate} Mbps` : 'N/A' },
    },
  };
}

