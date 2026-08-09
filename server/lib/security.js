// security.js — Wireless security analysis & Evil Twin / Rogue AP detection.

export function detectRogueAccessPoints(currentWifi, nearbyNetworks = []) {
  if (!currentWifi || !currentWifi.ssid) return [];

  const rogues = [];
  const currentSsid = currentWifi.ssid;
  const currentBssid = currentWifi.bssid;

  for (const net of nearbyNetworks) {
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
