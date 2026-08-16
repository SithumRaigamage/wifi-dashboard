// bandwidthTracker.js — US-23: sustained-high-throughput alerting.
//
// True *per-device* bandwidth attribution across the LAN would need either
// router-level per-client stats (SNMP/admin API) or packet capture — neither
// available to this no-sudo, single-host process (the same constraint the
// README documents for the LAN RTT quality pill: no per-device data without
// router access). What this app can genuinely measure is its own network
// interface's throughput (systeminformation.networkStats, already used for
// the Overview throughput chart), so that's what this tracks: is *this
// machine* sustaining high bandwidth usage — not "which LAN device is
// hogging bandwidth," which this architecture has no way to determine.

export function createBandwidthHogTracker() {
  let aboveSince = null; // timestamp the rate first crossed the threshold
  let alerted = false; // already emitted for this continuous streak above threshold

  return {
    // Call on every throughput tick. Returns an event descriptor the first
    // time the threshold has been held continuously for `sustainedMs`, else
    // null. `now` is injectable for testing without waiting in real time.
    check(totalMbps, { thresholdMbps, sustainedMs }, now = Date.now()) {
      if (totalMbps < thresholdMbps) {
        aboveSince = null;
        alerted = false;
        return null;
      }
      if (aboveSince == null) aboveSince = now;
      const sustainedFor = now - aboveSince;
      if (sustainedFor >= sustainedMs && !alerted) {
        alerted = true;
        return { totalMbps: Math.round(totalMbps * 10) / 10, sustainedMs: sustainedFor };
      }
      return null;
    },
  };
}
