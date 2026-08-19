// security.js — Wireless security analysis & Evil Twin / Rogue AP detection.

// macOS's literal placeholder for an SSID it won't reveal to an unprivileged
// process (no Location Services permission) — the documented norm for this
// app, not an edge case. Every redacted network shows this exact same string,
// so treating it as a real SSID would match every neighbor's network against
// every other, including our own.
const REDACTED = '<redacted>';

export function detectRogueAccessPoints(currentWifi, nearbyNetworks = []) {
  if (!currentWifi || !currentWifi.ssid || currentWifi.ssid === REDACTED) return [];

  const rogues = [];
  const currentSsid = currentWifi.ssid;
  const currentBssid = currentWifi.bssid;

  for (const net of nearbyNetworks) {
    if (net.ssid === REDACTED) continue; // can't compare an unresolved SSID to anything
    // Note: `net.bssid &&` below is what actually protects against the
    // redacted-network false-positive case (macOS never provides a BSSID for
    // an unresolved nearby network, confirmed directly against real output —
    // a structural property of the redaction, not dependent on matching its
    // exact placeholder text). An earlier version of this function also
    // suppressed any SSID shared by 2+ neighbors as extra insurance, but that
    // provided no additional protection against the real failure mode (the
    // bssid check already covers it) while creating a real one: it would
    // just as easily hide a genuine evil twin that happens to reuse a common
    // SSID also broadcast by an unrelated neighbor — exactly the kind of
    // collision an attacker could deliberately exploit by spoofing a common
    // default SSID. Removed.
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
