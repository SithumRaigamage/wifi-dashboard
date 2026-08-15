// security.js — Wireless security analysis & Evil Twin / Rogue AP detection.

// macOS's literal placeholder for an SSID it won't reveal to an unprivileged
// process (no Location Services permission) — the documented norm for this
// app, not an edge case. Every redacted network shows this exact same string,
// so treating it as a real SSID would match every neighbor's network against
// every other, including our own.
const REDACTED = '<redacted>';

export function detectRogueAccessPoints(currentWifi, nearbyNetworks = []) {
  if (!currentWifi || !currentWifi.ssid || currentWifi.ssid === REDACTED) return [];

  // Defense-in-depth beyond the exact REDACTED string match above: if the
  // *same* SSID value shows up on 2+ different neighbor networks, that value
  // is almost certainly a shared "can't tell you" placeholder rather than a
  // real, distinguishable SSID (genuine duplicate-SSID evil twins are rare;
  // this catches the same mass-false-positive failure mode even if macOS
  // ever uses a different placeholder string than the one hardcoded above —
  // a different locale, a future OS version, etc.).
  const ssidCounts = new Map();
  for (const net of nearbyNetworks) {
    if (net.ssid) ssidCounts.set(net.ssid, (ssidCounts.get(net.ssid) || 0) + 1);
  }

  const rogues = [];
  const currentSsid = currentWifi.ssid;
  const currentBssid = currentWifi.bssid;

  for (const net of nearbyNetworks) {
    if (net.ssid === REDACTED) continue; // can't compare an unresolved SSID to anything
    if (ssidCounts.get(net.ssid) > 1) continue; // shared by multiple neighbors — looks like a placeholder, not a real match
    if (net.ssid === currentSsid && net.bssid && net.bssid !== currentBssid) {
      // Same SSID name, but different BSSID!
      const securityMismatch = currentWifi.security && net.security && currentWifi.security !== net.security;
      rogues.push({
        ssid: net.ssid,
        bssid: net.bssid,
        rssi: net.rssi,
        channel: net.channel,
        security: net.security,
        reason: securityMismatch
          ? `Evil Twin: Security standard mismatch (${net.security} vs ${currentWifi.security})`
          : `Rogue AP: Unrecognized BSSID broadcasting home SSID ${currentSsid}`,
      });
    }
  }

  return rogues;
}
