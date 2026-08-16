import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Escapes a value for safe interpolation into an HTML string (innerHTML,
// generated report markup, ...). Anything derived from network data - an
// SSID, a device hostname/vendor - is chosen by whoever configured that
// device, not by this app, so it has to be treated as untrusted before it
// ever reaches raw HTML.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

// Convert bytes/sec to Mbps (number), for chart values + metric cards.
export function toMbps(bytesPerSec) {
  if (bytesPerSec == null) return null;
  return (bytesPerSec * 8) / 1e6;
}

// Human Mbps label with sensible precision.
export function fmtMbps(mbps) {
  if (mbps == null) return '—';
  if (mbps >= 100) return mbps.toFixed(0);
  if (mbps >= 10) return mbps.toFixed(1);
  return mbps.toFixed(2);
}

export function fmtDuration(seconds) {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Compact relative time ("just now", "5m ago", "3h ago", "2d ago").
export function fmtRelative(ts) {
  if (ts == null) return '';
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

// Absolute short date+time for tooltips / first-seen labels.
export function fmtDateTime(ts) {
  if (ts == null) return '';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
