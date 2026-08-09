# WiFi Dashboard — Extra Features (Backlog)

Companion to `wifi-dashboard-plan.md` and `wifi-dashboard-design-spec.md`.

**Note:** the design spec now includes a side navigation structure (Overview / Devices / History / Diagnostics / Alerts / Settings) with most of the items below already placed into a section. Treat the items marked **[in design spec]** as scoped/ready to build against that structure; treat everything else as further additions on top once the core sections are working.

---

## Navigation & structure **[in design spec]**

- **Side navigation bar** — collapsible left sidebar with sections: Overview, Devices, History, Diagnostics, Alerts, Settings. Active section highlighted, icon + label per item, collapses to icon-only on smaller screens. Fully specified in the design spec now.

## Alerts & notifications

- **Threshold alerts** **[in design spec — Alerts section]** — banner/toast when signal drops below a set dBm, latency exceeds a threshold, or packet loss spikes. Configurable thresholds.
- **Disconnect detection** — flag and timestamp any gap in the polling loop (internet/WiFi dropped), show a "downtime today: Xm" stat. Feeds the Alerts event log.
- **New device alert** — notify when a MAC address not seen before joins the LAN. Feeds the Alerts event log.
- **Daily/weekly summary** — a generated recap card: average speed, worst latency spike, total downtime, busiest hour. Could live at the top of the Alerts or History section.

## Device management **[in design spec — Devices section]**

- **Device naming** — inline-editable name per device, store MAC → friendly name mapping locally.
- **Device history** — "first seen" / "last seen" timestamps per device, connection count over time.
- **Device grouping/tags** — Work/Personal/IoT/Guest tags for filtering the device list.
- **Bandwidth per device** — if your router/OS supports it, break down throughput by device rather than just aggregate (Phase 3 stretch item — router-dependent, not guaranteed feasible).

## Historical analytics **[in design spec — History section]**

- **Heatmap of usage** — day-of-week × hour-of-day grid showing when throughput/latency is typically worst.
- **Longer retention + downsampling** — keep raw data for 24h, roll up to hourly averages beyond that, so history charts stay fast over weeks/months.
- **Comparison view** — "this week vs last week" overlay on the history chart. Not yet in the spec — add as a toggle next to the 1h/24h buttons if wanted.
- **Exportable reports** — CSV or PDF export of a date range's stats. Not yet in the spec — a good small addition to the History section header.

## Diagnostics **[in design spec — Diagnostics section]**

- **Channel congestion view** — bar chart of nearby networks per channel (requires `nmcli`/`airport -s` scanning; the mockup uses illustrative data since this needs real scan access).
- **DNS resolution timing** — separate DNS lookup time from raw ping latency.
- **Traceroute on demand** — target input + "Run" button + hop list with per-hop latency.
- **Outage log with likely cause** — correlate a disconnect with what changed (signal dropped first vs latency spiked first) to hint at whether it's WiFi, ISP, or DNS. Not yet in the spec — would extend the Alerts event log with a "likely cause" tag.

## Configuration & settings **[in design spec — Settings section]**

- **Settings panel** — polling interval, ping target host, data retention length, plus toggles for a public read-only status page and Slack/Discord push alerts.
- **Multiple network profiles** — if monitoring more than one location/router, a switcher between them (each with its own history). Not yet in the spec — would need a profile switcher above the sidebar nav.
- **Auth/login** — if you ever expose this dashboard outside localhost, add basic auth before deploying anywhere reachable off your machine.

## Visualization polish

- **Themeable dashboard** — light/dark toggle wired to the CSS variables from the design spec (already token-based, so this is mostly a toggle + persisted preference). Natural fit for the Settings section.
- **Signal strength map** — walk around with a laptop/phone logging RSSI + rough location, render a heatmap overlay on a floor plan image. Bigger lift, its own section if pursued.
- **Live topology view** — a simple node graph: router in the center, connected devices as nodes around it, line thickness mapped to bandwidth use. Could replace or supplement the Devices list view.

## Nice-to-haves / lower priority

- **Mobile-responsive layout tightening** — collapse the 4-card grid to 2x2 or a horizontal scroll on small screens.
- **Push notifications** — browser push (or a Discord/Slack webhook) for critical alerts even when the dashboard tab isn't open.
- **Public status page mode** — a stripped-down read-only view for sharing with family/roommates ("is the WiFi down for everyone or just me").

---

## Suggested next pick

If you want one high-value addition to build next after the MVP, **threshold alerts + disconnect detection** are usually the most immediately useful — they turn the dashboard from "something I glance at" into "something that tells me when to actually care."
