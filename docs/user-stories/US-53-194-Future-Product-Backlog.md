# WiFi Analytics Dashboard — Future Product Backlog (US-053–US-194)

**Author:** VentureForge AI (Senior Business Analyst / PM / UX Strategist / Network Observability / DevOps / Security / Solution Architecture)
**Baseline:** [README.md](../../README.md) + [docs/user-stories/README.md](./README.md) (US-01–US-52)
**Scope:** 142 new user stories evolving the product from a Wi-Fi monitoring dashboard into a network intelligence, observability, and security platform — without duplicating anything already shipped (US-01–18) or already specced (US-19–52).

---

## Executive Summary

The current product is a genuinely capable **single-host network observability tool**: live Wi-Fi/LAN/throughput/latency telemetry, MySQL/SQLite-backed history, a real event/alert pipeline, and eighteen shipped advanced-analysis features (roaming, rogue-AP detection, SNR, distance estimation, DFS-hop logging, band steering, floor-plan heatmaps, kiosk mode, i18n). Thirty-four more stories (US-19–52) are already specced but unbuilt, covering security scanning, ML anomaly detection, troubleshooting tools, and integrations.

What's missing is the layer that turns *metrics* into *decisions*: correlation across signals, an explainable root-cause engine, baselines the system learns instead of static thresholds, an alert/incident lifecycle instead of a flat event log, and reporting/API surfaces that let the tool integrate into a household's or small office's actual operating rhythm. This backlog (US-053–US-194) is built entirely on top of the **existing collectors, WebSocket schema, REST layer, and dual MySQL/SQLite store** — no rip-and-replace, no invented data sources.

A hard constraint threads the whole backlog: **this is a single Node process running on one macOS host with no router access.** Every story below is tagged with what data tier it actually needs (locally measurable today vs. requires router API vs. requires elevated/packet-capture permission vs. requires an external API), and stories that would require infrastructure this product doesn't have are explicitly deferred or killed in the Kill/Keep/Invest section.

---

## Existing Capability Analysis

From the README, the shipped surface area is:

- **Collectors:** `wifiStats.js` (RSSI/SNR/BSSID/PHY/Wi-Fi-6+7/nearby networks), `latency.js`, `lanDevices.js`, `speedtest.js`, `channels.js`, `dns.js`, `traceroute.js`.
- **Server lib:** `db.js` (dual MySQL/SQLite), `security.js` (rogue AP), `history.js` (rollups/heatmap/CSV), `events.js`, `devices.js`, `settings.js`, `email.js`, `logger.js`.
- **REST:** live metrics, `/api/history*`, `/api/diagnostics/*`, `/api/events`, `/api/settings`, `/api/email/test`, `/api/status/public`, `/api/devices/scan`, `/api/speedtest/run`.
- **WebSocket:** `wifi | throughput | latency | devices | dns | event | settings | speedtest` push channels.
- **UI:** Overview, Devices, Floor Plan, History, Diagnostics, Alerts, Settings, Kiosk overlay, PiP HUD — with health gauge, network topology, BSSID inspector, SNR graph, band-steering analyzer.
- **Alerting:** disconnect / new-device / signal / latency / loss / roam / rogue-AP / DFS-hop → event log → webhook + email.

This is a strong **collection and single-metric-alerting** layer. It is not yet a **correlation, baseline, diagnosis, or lifecycle** layer.

---

## Gaps Identified

| Gap | Why it matters | Addressed by |
|---|---|---|
| No cross-metric correlation or "why" explanation | User sees five charts, has to do the correlation in their head | Category A, F |
| Static thresholds only (`signalFloor`, `latencyCeiling`, `lossCeiling`) | One-size-fits-all thresholds are wrong for most homes | Category BB |
| Flat event log, no lifecycle | Can't acknowledge, group, or escalate; noisy events erode trust | Category L, M |
| No reporting artifact | Nothing to hand to an ISP, roommate, or your future self | Category N |
| Bandwidth section of README already flags per-device router bandwidth as unbuilt stretch | Easy to over-promise bandwidth data the app cannot see | Category D (explicit data-tier framework) |
| No public API contract | Integrations (US-45/46/52 in the existing backlog) need a stable API surface first | Category X |
| Single implicit "network" | Laptops move between home/office/guest — history conflates them | Category V |
| No self-observability | If a collector silently stops, the dashboard just goes stale | Category R, S |

---

## 142 New User Stories

Personas used: **Personal User (PU)**, **Power User (PWU)**, **Developer (DEV)**, **Network Administrator (NA)**, **IT Support Engineer (ITS)**, **Security-Conscious User (SCU)**, **Smart Home User (SHU)**, **Small Business User (SBU)**, **Researcher (RES)**, **System Integrator (SI)**, **Automation User (AU)**.

### Category A — Advanced Real-Time Analytics (US-053–US-060)

#### US-053 — Real-Time Network Stability Index
**As a** PWU **I want** a single live score combining RSSI variance, latency jitter, and packet loss over a rolling window **so that** I can tell "is my network stable right now" at a glance.
**Priority:** High · **Category:** Real-Time Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given the last 5 minutes of wifi/latency samples, when the score recomputes each tick, then it renders 0–100 with a stability label (Stable/Fluctuating/Unstable).
- And the score's three input weights are visible on hover, not a black box.
**Dependencies:** existing `wifi`/`latency` WS streams, `useLiveData.js` rolling buffers.
**Implementation Notes:** pure client-side rolling stddev over the buffers already held in `useLiveData.js`; no new collector needed.

#### US-054 — Real-Time Metric Correlation Panel
**As a** DEV **I want** RSSI, latency, and loss plotted on one synchronized timeline **so that** I can visually spot when they move together.
**Priority:** High · **Category:** Real-Time Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given live data is flowing, when I open the panel, then all three series share one x-axis and independent y-axes.
- And hovering one series highlights the same timestamp on the others.
**Dependencies:** US-053's shared buffers; Recharts (already a dependency).
**Implementation Notes:** new Overview/Diagnostics widget; no backend change.

#### US-055 — Connection Quality Trend Badges
**As a** PU **I want** small up/down trend arrows next to each metric card **so that** I know if things are getting better or worse without reading a chart.
**Priority:** Medium · **Category:** Real-Time Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given 10 minutes of history, when the current 2-minute average differs from the prior 2-minute average by a threshold, then an arrow + color renders.
**Dependencies:** existing `MetricCards.jsx`.
**Implementation Notes:** client-only, derived from existing buffers.

#### US-056 — Live "vs. Your Typical" Ribbon
**As a** PWU **I want** each metric card to show how today's live value compares to my historical baseline for this time of day **so that** I know if "slow" is actually unusual for me.
**Priority:** High · **Category:** Real-Time Analytics · **Complexity:** L
**Acceptance Criteria:**
- Given a learned baseline exists (US-189), when live RSSI/latency renders, then a "vs typical" sub-label shows (e.g. "12ms above your Tue-2pm average").
**Dependencies:** US-189 Baseline Engine.
**Implementation Notes:** requires baseline table; falls back to "learning your baseline" state for first 7 days.

#### US-057 — Live Anomaly Indicator Badges
**As a** SCU **I want** a visible badge the instant a live metric deviates statistically from normal **so that** I notice problems before an alert threshold is crossed.
**Priority:** High · **Category:** Real-Time Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given US-050's anomaly service flags a sample, when it arrives over WS, then the relevant card shows a pulsing badge for 60s.
**Dependencies:** US-050 Anomaly Detection Service.
**Implementation Notes:** new `anomaly` WS message type; badge is purely presentational.

#### US-058 — Metric Dependency Explorer
**As a** RES **I want** to click any historical metric spike and see which other metrics moved in the same window **so that** I can build my own intuition for cause/effect.
**Priority:** Medium · **Category:** Real-Time Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given a point on any history chart, when clicked, then a side panel lists other metrics' values ±2 minutes around that timestamp.
**Dependencies:** `/api/history` range query.
**Implementation Notes:** one new endpoint `/api/history/context?ts=`.

#### US-059 — Rolling Percentile Gauges (P50/P95/P99)
**As a** RES **I want** live P50/P95/P99 gauges for latency and throughput **so that** I see tail behavior, not just averages.
**Priority:** Medium · **Category:** Real-Time Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given the rolling buffer, when recomputed each tick, then three gauges render with the correct percentile math.
**Dependencies:** none beyond existing buffers.
**Implementation Notes:** small stats helper in `client/src/lib`.

#### US-060 — Synchronized Live Chart Scrubber
**As a** PWU **I want** one cursor that scrubs across all live charts at once **so that** I can compare exact values at a single instant.
**Priority:** Low · **Category:** Real-Time Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given multiple charts on Overview, when I drag on one, then a synced vertical guide appears on all.
**Dependencies:** US-054.
**Implementation Notes:** shared hover-state context around Recharts instances.

---

### Category B — Network Performance Intelligence (US-061–US-069)

#### US-061 — TCP Connection Establishment Timing
**As a** DEV **I want** to measure SYN→SYN-ACK time to a configurable host **so that** I can separate "the network is slow" from "this specific service is slow to accept connections."
**Priority:** Medium · **Category:** Network Performance · **Complexity:** M
**Acceptance Criteria:**
- Given a target host:port, when a TCP connect probe runs, then connect time in ms is recorded and charted.
- And failures are distinguished from slow-but-successful connects.
**Dependencies:** Node `net.Socket` connect timing — no new privilege needed.
**Implementation Notes:** new collector `server/collectors/tcpProbe.js`; reuses `history.js` storage pattern.

#### US-062 — TLS Handshake Latency Tracker
**As a** PWU **I want** to see how long the TLS handshake takes to a given HTTPS host **so that** I can tell if slowness is at the crypto/negotiation layer.
**Priority:** Medium · **Category:** Network Performance · **Complexity:** M
**Acceptance Criteria:**
- Given an HTTPS target, when probed, then TCP-connect time and TLS-handshake time are reported separately.
**Dependencies:** US-061; Node `tls` module.
**Implementation Notes:** extends the same probe collector.

#### US-063 — HTTP Response Time Probe
**As a** SBU **I want** to time full HTTP GET response to a configurable URL on a schedule **so that** I can watch a specific service (my ISP's status page, my work VPN portal) alongside network health.
**Priority:** Medium · **Category:** Network Performance · **Complexity:** M
**Acceptance Criteria:**
- Given a configured URL, when probed on interval, then status code, TTFB, and total time are stored and charted.
**Dependencies:** US-061/062 probe collector.
**Implementation Notes:** validated-target pattern reused from `traceroute.js`.

#### US-064 — Jitter Measurement & Trend
**As a** PWU **I want** ping jitter (inter-packet delay variance), not just average latency **so that** I understand why video calls stutter even when average latency looks fine.
**Priority:** High · **Category:** Network Performance · **Complexity:** S
**Acceptance Criteria:**
- Given the existing ping loop, when successive RTTs are compared, then jitter (mean absolute delta) is computed and exposed on the `latency` WS payload.
**Dependencies:** `server/collectors/latency.js` (extend, no new collector).
**Implementation Notes:** additive field, no schema break.

#### US-065 — Packet Retransmission Estimate
**As a** DEV **I want** an estimate of retransmission behavior toward a target **so that** I can gauge path quality beyond simple loss %.
**Priority:** Low · **Category:** Network Performance · **Complexity:** L
**Acceptance Criteria:**
- Given repeated TCP probes (US-061) to the same host, when connect retries or resets occur, then a retransmission-indicator rate is derived and labeled "estimate."
**Dependencies:** US-061. Note: true retransmission counts require packet capture; this is a connect-retry proxy, clearly labeled as such.
**Implementation Notes:** no elevated permission required for the proxy metric; a true packet-capture version is out of scope (see Kill list).

#### US-066 — Gateway (First-Hop) Performance Isolation
**As a** ITS **I want** the first traceroute hop's RTT tracked continuously, separate from full internet RTT **so that** I can tell LAN-to-gateway problems from ISP problems.
**Priority:** High · **Category:** Network Performance · **Complexity:** S
**Acceptance Criteria:**
- Given a periodic lightweight traceroute/ping to the default gateway, when it runs, then gateway RTT is stored and charted next to internet RTT.
**Dependencies:** `traceroute.js`, `latency.js`.
**Implementation Notes:** reuse traceroute's first-hop parse; add a fast gateway-only ping cadence.

#### US-067 — Internet vs. LAN Performance Split View
**As a** PU **I want** a side-by-side "Your Wi-Fi/LAN" vs. "Your Internet" card **so that** I immediately know which half of the path is the problem.
**Priority:** High · **Category:** Network Performance · **Complexity:** S
**Acceptance Criteria:**
- Given US-066's gateway RTT and existing internet ping, when both are available, then a two-column card renders with color-coded status per side.
**Dependencies:** US-066.
**Implementation Notes:** pure UI composition of existing + new data.

#### US-068 — Rule-Based Network Bottleneck Identifier
**As a** PU **I want** the app to tell me "the problem looks like Wi-Fi / LAN / gateway / ISP / DNS" **so that** I don't have to interpret five charts myself.
**Priority:** Critical · **Category:** Network Performance · **Complexity:** L
**Acceptance Criteria:**
- Given RSSI, gateway RTT, internet RTT, DNS timing, and loss are all available, when a slowdown is detected, then a rule-based classifier outputs one primary suspect layer with the evidence values.
**Dependencies:** US-066, US-067, existing DNS collector.
**Implementation Notes:** first-class citizen of the Intelligent Diagnostics Engine (Category F); implemented as a shared reusable classifier function.

#### US-069 — IPv4 vs. IPv6 Path Comparison
**As a** DEV **I want** to see whether IPv4 and IPv6 paths to the same target differ in latency/reachability **so that** I can catch IPv6 misconfiguration silently hurting performance.
**Priority:** Low · **Category:** Network Performance · **Complexity:** M
**Acceptance Criteria:**
- Given a dual-stack target, when pinged over both families, then both RTTs are shown side by side with a reachability flag per family.
**Dependencies:** Node `dns`/`ping` family option.
**Implementation Notes:** extends `latency.js` optionally, off by default (extra probes).

---

### Category C — Device Intelligence 2.0 (US-070–US-078)

#### US-070 — Device Profile Page
**As a** NA **I want** a dedicated page per device with its full history, tags, and sightings **so that** I have one place to understand any device on my network.
**Priority:** High · **Category:** Device Intelligence · **Complexity:** M
**Acceptance Criteria:**
- Given a device MAC, when I click into it from Devices/Topology, then a profile view shows name, vendor, first/last seen, RTT history, and event history.
**Dependencies:** existing `devices.js`, `deviceStore.js`.
**Implementation Notes:** new client route `?device=<mac>`; one new endpoint `/api/devices/:mac`.

#### US-071 — Device Category Tagging
**As a** SHU **I want** to tag devices as Phone/Laptop/IoT/Speaker/Camera/etc. (with heuristic suggestions from vendor OUI) **so that** the Devices list is organized by what things actually are.
**Priority:** Medium · **Category:** Device Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given a device's OUI vendor, when displayed, then a suggested category chip appears; user can override and it persists.
**Dependencies:** `ouiVendors.js`, `deviceStore.js`.
**Implementation Notes:** small heuristic table (vendor substring → category); stored alongside existing name/tag.

#### US-072 — Device Behavior Timeline
**As a** ITS **I want** a chronological timeline of connect/disconnect/roam events for one device **so that** I can diagnose "why does this device keep dropping."
**Priority:** High · **Category:** Device Intelligence · **Complexity:** M
**Acceptance Criteria:**
- Given a device MAC, when its profile loads, then all matching events from the event log render on a timeline.
**Dependencies:** US-070, existing `events.js`.
**Implementation Notes:** filter existing events table by MAC in `meta`.

#### US-073 — Device Reliability Score
**As a** NA **I want** a % score for how consistently a device is reachable when expected **so that** I can spot flaky IoT devices before they become annoying.
**Priority:** Medium · **Category:** Device Intelligence · **Complexity:** M
**Acceptance Criteria:**
- Given sighting history over the last 7/30 days, when computed, then reliability = time-seen ÷ time-expected-seen, with "expected" derived from historical presence pattern.
**Dependencies:** `devices.js` sightings table.
**Implementation Notes:** batch job in `history.js`'s rollup cycle.

#### US-074 — Device Risk Score (Heuristic)
**As a** SCU **I want** a heuristic risk indicator per device (randomized MAC, unknown vendor, very recent first-seen, flapping connections) **so that** I know which devices deserve a closer look.
**Priority:** High · **Category:** Device Intelligence · **Complexity:** M
**Acceptance Criteria:**
- Given a device's metadata and behavior history, when scored, then a Low/Medium/High risk chip renders with the contributing factors listed on hover.
**Dependencies:** US-071 (category), US-072 (behavior), existing random-MAC tagging.
**Implementation Notes:** explicitly rule-based and explainable — not a black-box score.

#### US-075 — Unknown Device Triage Workflow
**As a** PU **I want** a guided "who is this?" flow the first time a new device appears **so that** I can quickly name/trust/flag it instead of ignoring the alert.
**Priority:** High · **Category:** Device Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given a new-device event, when I open it from Alerts, then a modal offers vendor guess, quick-name input, and Trust/Flag buttons.
**Dependencies:** US-071, existing new-device event.
**Implementation Notes:** UI-only, wraps existing naming + new US-076 trust flag.

#### US-076 — Trusted Device Policy Rules
**As a** SCU **I want** to mark devices as trusted and get elevated alert severity for any *untrusted* device on the network **so that** noise from my own known devices doesn't bury real intrusions.
**Priority:** High · **Category:** Device Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given a device is untagged trusted, when a new-device event fires for it, then severity is elevated (danger vs. info) and it's visually distinct in Alerts.
**Dependencies:** `deviceStore.js`, `events.js`.
**Implementation Notes:** boolean flag added to device metadata; event severity computed at emit time.

#### US-077 — Device Grouping (Rooms / Owners / Custom Tags)
**As a** SBU **I want** to group devices by room, owner, or custom label **so that** the Devices/Topology views can be filtered meaningfully in a larger household or office.
**Priority:** Medium · **Category:** Device Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given a group label field per device, when set, then Devices and Topology support filter-by-group.
**Dependencies:** `deviceStore.js`.
**Implementation Notes:** free-text group field + filter chips.

#### US-078 — Device Comparison View
**As a** RES **I want** to select 2–4 devices and compare their RTT/uptime/reliability side by side **so that** I can tell if a problem is device-specific or network-wide.
**Priority:** Low · **Category:** Device Intelligence · **Complexity:** M
**Acceptance Criteria:**
- Given a multi-select on Devices, when 2–4 are chosen, then a comparison table/chart renders their key metrics aligned on one timeline.
**Dependencies:** US-070, US-073.
**Implementation Notes:** client-side composition of existing per-device data.

---

### Category D — Bandwidth & Resource Intelligence (US-079–US-084)

> **Data-tier note:** true per-device bandwidth requires router integration (already correctly marked "Phase 3 (stretch)" / router-admin-dependent in the existing README and US-23). Everything below is scoped to what the **host machine itself** can measure via `systeminformation`, or is explicit scaffolding for a future router integration — nothing here claims per-device bandwidth without router access.

#### US-079 — Local Bandwidth Attribution Estimate (This Host)
**As a** PU **I want** to see how much of my *own machine's* up/down throughput is being used over time **so that** I understand my own usage pattern, clearly separate from other devices on the LAN.
**Priority:** Medium · **Category:** Bandwidth Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given `systeminformation.networkStats` (already used for throughput), when aggregated hourly, then a "this machine" usage view renders, explicitly labeled as host-only.
**Dependencies:** existing throughput collector.
**Implementation Notes:** relabels/extends existing data; no new source.

#### US-080 — Bandwidth Usage Trend Report (This Host)
**As a** SBU **I want** a daily/weekly trend of this machine's bandwidth usage **so that** I can spot creeping growth (backups, sync tools) before it saturates my link.
**Priority:** Medium · **Category:** Bandwidth Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given `history.js` hourly rollups, when queried by day/week, then a trend chart + total GB summary renders.
**Dependencies:** US-079.
**Implementation Notes:** new query against existing rollup table.

#### US-081 — Peak Utilization Window Detector (This Host)
**As a** PWU **I want** the system to identify my busiest hour(s) of the day/week **so that** I know when to schedule large downloads or avoid contention.
**Priority:** Low · **Category:** Bandwidth Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given rollups, when analyzed weekly, then top-3 peak hours are surfaced (reuses the existing "busiest hour" summary field, extended to top-N).
**Dependencies:** existing `/api/history/summary`.
**Implementation Notes:** extend existing summary computation.

#### US-082 — Bandwidth Anomaly Alert (This Host)
**As a** SCU **I want** an alert when this machine's throughput spikes far above its own baseline **so that** I notice unexpected uploads (e.g. malware exfiltration, runaway sync).
**Priority:** High · **Category:** Bandwidth Intelligence · **Complexity:** M
**Acceptance Criteria:**
- Given US-189's baseline engine has a throughput baseline, when live throughput exceeds baseline + N standard deviations sustained for 60s, then a new `bandwidth-anomaly` event fires.
**Dependencies:** US-189 Baseline Engine.
**Implementation Notes:** new event kind, reuses existing `events.js` pipeline.

#### US-083 — Router-Integration Bandwidth Readiness Framework
**As a** NA **I want** a settings scaffold and clearly-labeled "not connected" panel for future per-device router bandwidth **so that** the feature has a home to slot into once a router integration exists, without faking data today.
**Priority:** Low · **Category:** Bandwidth Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given no router API is configured, when I view Devices, then a "Per-device bandwidth requires router integration (not yet connected)" panel renders instead of fabricated numbers.
**Dependencies:** none.
**Implementation Notes:** pure UI honesty scaffold; pairs with US-25 (Router Admin Portal Security Scanner) as the eventual data source.

#### US-084 — Fair-Usage Threshold Alert (This Host)
**As a** SBU **I want** to set a soft daily/monthly cap on this machine's usage and get alerted when approaching it **so that** I can self-manage a metered/capped ISP plan.
**Priority:** Medium · **Category:** Bandwidth Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given a configured cap in Settings, when cumulative monthly usage (US-079) crosses 80%/100%, then warning/danger events fire.
**Dependencies:** US-079, `settings.js`.
**Implementation Notes:** new settings fields + threshold check in the existing rollup cycle.

---

### Category E — Advanced Security & Threat Monitoring (US-085–US-093)

#### US-085 — Suspicious MAC Change Detector
**As a** SCU **I want** an alert when the same IP address suddenly presents a different MAC than it has historically **so that** I catch spoofing that a simple duplicate-IP check (US-20) wouldn't.
**Priority:** High · **Category:** Advanced Security · **Complexity:** M
**Acceptance Criteria:**
- Given `devices.js` sighting history per IP, when a new sighting's MAC doesn't match the IP's dominant historical MAC, then a `mac-change` event fires with both MACs in `meta`.
**Dependencies:** `lanDevices.js`, `devices.js`.
**Implementation Notes:** distinct from US-20 (duplicate IP across two *simultaneous* devices) — this is temporal drift on one IP.

#### US-086 — Gateway Impersonation Alert
**As a** SCU **I want** an alert if my default gateway's MAC address changes unexpectedly **so that** I get an early signal of a possible man-in-the-middle/ARP-spoof against my router itself.
**Priority:** Critical · **Category:** Advanced Security · **Complexity:** M
**Acceptance Criteria:**
- Given the gateway IP (from existing traceroute/route info) is polled via `arp -a`, when its MAC changes without a corresponding known-router-replacement action, then a `gateway-mac-change` danger event fires.
**Dependencies:** `lanDevices.js` arp parsing (already used).
**Implementation Notes:** no elevated permission needed — `arp -a` is already how the app discovers devices.

#### US-087 — Suspicious DHCP Behavior Monitor
**As a** NA **I want** to be warned about anomalous DHCP activity on my segment **so that** I can catch a rogue DHCP server.
**Priority:** Medium · **Category:** Advanced Security · **Complexity:** XL
**Acceptance Criteria:**
- Given a passive listener on the LAN, when more than one DHCP server offer is observed, then a `rogue-dhcp` event fires with both server IPs.
**Dependencies:** raw socket capture.
**Implementation Notes:** ⚠️ **Requires elevated permission** (raw socket / packet capture), unlike the rest of this backlog. Flagged as an optional, explicitly-elevated add-on module — ship behind a feature flag with a clear sudo/permission prompt, never silently escalate privileges.

#### US-088 — Security Posture Score
**As a** SCU **I want** one composite security score combining encryption strength, rogue-AP history, untrusted-device count, and open-network status **so that** I have a single number to track over time.
**Priority:** High · **Category:** Advanced Security · **Complexity:** M
**Acceptance Criteria:**
- Given current wifi security type, rogue-AP event count (30d), and untrusted device count, when computed, then a 0–100 score renders with the contributing factors listed.
**Dependencies:** existing `security.js`, US-076 (trust flags).
**Implementation Notes:** rule-based weighted sum, fully explainable (same philosophy as US-053, US-138).

#### US-089 — Security Event Timeline
**As a** ITS **I want** one unified feed of every security-relevant event (rogue AP, new device, MAC change, gateway change) **so that** I don't have to cross-reference the general event log.
**Priority:** Medium · **Category:** Advanced Security · **Complexity:** S
**Acceptance Criteria:**
- Given the existing events table, when filtered by `kind IN (security kinds)`, then a dedicated Security tab in Alerts renders them chronologically.
**Dependencies:** existing `events.js`.
**Implementation Notes:** filtered view + tag list, no schema change.

#### US-090 — Security Recommendations Engine
**As a** PU **I want** plain-language, rule-based recommendations ("Your network uses WPA2, consider WPA3 if your router supports it," "3 untrusted devices seen this week") **so that** I know what to actually do about my score.
**Priority:** Medium · **Category:** Advanced Security · **Complexity:** M
**Acceptance Criteria:**
- Given US-088's score inputs, when below a threshold on any dimension, then a corresponding recommendation string renders with a "why" explanation.
**Dependencies:** US-088.
**Implementation Notes:** static rule table mapping condition → recommendation text; no ML.

#### US-091 — Periodic Security Audit Report
**As a** SBU **I want** a scheduled snapshot of my security posture and findings **so that** I have a record I can review monthly or hand to whoever manages the network.
**Priority:** Medium · **Category:** Advanced Security · **Complexity:** S
**Acceptance Criteria:**
- Given US-088/090, when a weekly/monthly schedule fires, then a report is generated and stored (ties into Category N Reporting).
**Dependencies:** US-088, US-137 (Scheduled Reports).
**Implementation Notes:** reuses the general reporting pipeline with a security template.

#### US-092 — New-Network-Join Confidence Check
**As a** SCU **I want** the app to sanity-check the network it just joined (BSSID/security matches what it's seen before for this SSID) **so that** I catch an evil-twin *at connection time*, not just from passive nearby scans (US-15).
**Priority:** High · **Category:** Advanced Security · **Complexity:** M
**Acceptance Criteria:**
- Given a known SSID→BSSID/security history, when the app detects a fresh association to that SSID with an unrecognized BSSID or weaker security, then a `join-confidence-low` warning fires immediately.
**Dependencies:** existing `wifiStats.js`, `security.js` (extends its detection to the "am I the one connected to the twin" case, not just nearby-scan).
**Implementation Notes:** complements, does not duplicate, US-15's passive nearby-network scan.

#### US-093 — Suspicious Reconnection Pattern Detector
**As a** SCU **I want** an alert if a device disconnects/reconnects abnormally often in a short window **so that** repeated flapping (a possible deauth-attack symptom, or just a failing device) gets surfaced.
**Priority:** Medium · **Category:** Advanced Security · **Complexity:** S
**Acceptance Criteria:**
- Given sighting history for a device, when disconnect/reconnect count exceeds N within M minutes, then a `reconnect-flapping` event fires, distinct in cause from a single disconnect.
**Dependencies:** `devices.js`, `events.js`.
**Implementation Notes:** simple sliding-window counter per MAC.

---

### Category F — Intelligent Diagnostics Engine (US-094–US-100)

#### US-094 — Root-Cause Diagnostic Engine (Rule-Based)
**As a** PU **I want** to click "Why is my Wi-Fi slow?" and get a structured, rule-based answer using current + recent signals **so that** I don't have to interpret raw metrics myself.
**Priority:** Critical · **Category:** Intelligent Diagnostics · **Complexity:** XL
**Acceptance Criteria:**
- Given RSSI, gateway RTT, internet RTT, DNS timing, loss, and channel congestion are all available, when the engine runs, then it outputs a ranked list of probable causes with supporting evidence values.
- And no cause is claimed without at least one supporting metric delta.
**Dependencies:** US-068 (bottleneck classifier is the core of this engine), all existing collectors.
**Implementation Notes:** explicitly **rule-based decision tree**, not ML — documented as such so users trust the "why."

#### US-095 — Evidence-Based Diagnostic Narrative
**As a** PU **I want** the diagnosis phrased as a sentence with numbers, e.g. "Internet performance degraded because DNS latency increased 240% while RSSI remained stable" **so that** the explanation is self-evidently grounded, not a black box.
**Priority:** High · **Category:** Intelligent Diagnostics · **Complexity:** M
**Acceptance Criteria:**
- Given US-094's ranked causes, when rendered, then each includes a template-generated sentence citing the actual before/after values.
**Dependencies:** US-094.
**Implementation Notes:** string templating over the engine's structured output — no LLM required for this story (see US-153 for the optional LLM narration layer).

#### US-096 — Diagnostic Confidence Score
**As a** DEV **I want** each diagnosed cause to carry a confidence indicator **so that** I know whether to trust a single-signal guess vs. a multi-signal conclusion.
**Priority:** Medium · **Category:** Intelligent Diagnostics · **Complexity:** M
**Acceptance Criteria:**
- Given N corroborating signals for a cause, when scored, then confidence scales with the count/strength of corroborating evidence (rule-weighted, not statistical inference).
**Dependencies:** US-094.
**Implementation Notes:** simple weighted-rule scoring, documented formula.

#### US-097 — Recommended Remediation Checklist
**As a** PU **I want** actionable steps tied to the diagnosed cause **so that** the diagnosis leads somewhere instead of just naming the problem.
**Priority:** High · **Category:** Intelligent Diagnostics · **Complexity:** S
**Acceptance Criteria:**
- Given a diagnosed cause (e.g. "channel congestion"), when displayed, then a checklist of concrete steps renders (e.g. "try channel X, currently least congested per Diagnostics").
**Dependencies:** US-094, existing `channels.js`.
**Implementation Notes:** static mapping, cause → checklist template, parameterized with live data where possible.

#### US-098 — Before/After Fix Verification
**As a** ITS **I want** to mark "I tried this fix" and have the app re-run a mini diagnostic after a few minutes to confirm improvement **so that** I get closure on whether the fix worked.
**Priority:** Medium · **Category:** Intelligent Diagnostics · **Complexity:** M
**Acceptance Criteria:**
- Given a remediation step is marked attempted, when 5 minutes elapse, then the engine re-runs and reports improved/unchanged/worse with the metric deltas.
**Dependencies:** US-094, US-099.
**Implementation Notes:** scheduled one-shot re-check keyed to the diagnostic run ID.

#### US-099 — Diagnostic History Log
**As a** NA **I want** a record of past diagnostic runs and their outcomes **so that** I can see if the same issue keeps coming back.
**Priority:** Medium · **Category:** Intelligent Diagnostics · **Complexity:** S
**Acceptance Criteria:**
- Given each diagnostic run, when completed, then it's persisted with timestamp, causes, confidence, and (if available) fix outcome.
**Dependencies:** US-094, `db.js`.
**Implementation Notes:** new `diagnostics` table, same dual MySQL/SQLite pattern as `events`/`history`.

#### US-100 — Recurring Problem Pattern Detector
**As a** PU **I want** to be told "this is the 4th time this month DNS latency has been the cause" **so that** I recognize a chronic issue instead of treating each incident as isolated.
**Priority:** Medium · **Category:** Intelligent Diagnostics · **Complexity:** M
**Acceptance Criteria:**
- Given US-099's diagnostic history, when a new run's top cause matches ≥3 prior runs within 30 days, then a "recurring issue" banner surfaces with the count and trend.
**Dependencies:** US-099.
**Implementation Notes:** simple group-by-cause query over the diagnostics table.

---

### Category G — AI / Machine Learning (US-101–US-107)

> Each story below states explicitly whether it is **rule-based**, **statistical**, **lightweight ML**, or **LLM-powered** — per the brief's requirement not to add AI for marketing's sake.

#### US-101 — Statistical Baseline Learning Engine
**As a** PWU **I want** the system to learn rolling mean/stddev per metric, per hour-of-week **so that** "normal" is personalized instead of a static number.
**Priority:** Critical · **Category:** AI/ML · **Complexity:** L
**Type:** Statistical (not ML).
**Acceptance Criteria:**
- Given N weeks of hourly rollups, when recomputed nightly, then a baseline table stores mean/stddev per metric per (day-of-week, hour) bucket.
- And baselines are marked "learning" until at least 7 days of data exist.
**Dependencies:** `history.js` hourly rollups.
**Implementation Notes:** this is the foundational story for US-056, US-082, US-138, US-189 — build once, reuse everywhere.

#### US-102 — Anomaly Detection Service
**As a** SCU **I want** live samples flagged when they deviate from the learned baseline by a statistical threshold (z-score/EWMA) **so that** real anomalies surface without a static threshold guessing wrong for my environment.
**Priority:** High · **Category:** AI/ML · **Complexity:** M
**Type:** Statistical.
**Acceptance Criteria:**
- Given US-101's baseline, when a live sample's z-score exceeds a configurable threshold, then an `anomaly` WS event fires with the metric, value, and expected range.
**Dependencies:** US-101.
**Implementation Notes:** feeds US-057, US-082.

#### US-103 — Alert Noise Suppression (Lightweight Clustering)
**As a** NA **I want** recurring, historically-benign alert patterns automatically muted **so that** my inbox isn't full of the same known-harmless blip every day.
**Priority:** Medium · **Category:** AI/ML · **Complexity:** L
**Type:** Lightweight ML (simple clustering on event feature vectors — kind, time-of-day, duration).
**Acceptance Criteria:**
- Given ≥10 similar past events the user has dismissed/ignored, when a new event matches that cluster, then it's auto-suppressed from push notifications (still logged) with a visible "auto-muted, why" explanation.
- And the user can un-mute a cluster at any time.
**Dependencies:** `events.js`, opt-in setting.
**Implementation Notes:** explicitly opt-in, explainable, reversible — no silent suppression of new alert kinds.

#### US-104 — Automatic Threshold Recommendation
**As a** PU **I want** the app to suggest better `signalFloor`/`latencyCeiling`/`lossCeiling` values based on my learned baseline **so that** my thresholds reflect my actual environment instead of generic defaults.
**Priority:** High · **Category:** AI/ML · **Complexity:** M
**Type:** Statistical.
**Acceptance Criteria:**
- Given US-101's baseline, when viewing Settings, then a "Recommended: -68 dBm (yours vs. default -70)" hint renders next to each threshold, one-click to apply.
**Dependencies:** US-101, `settings.js`.
**Implementation Notes:** pure suggestion, never auto-applies without user confirmation.

#### US-105 — Natural-Language Daily Summary (LLM, Opt-In)
**As a** PU **I want** an optional plain-English paragraph summarizing today's network health **so that** I don't have to read charts if I don't want to.
**Priority:** Medium · **Category:** AI/ML · **Complexity:** L
**Type:** LLM-powered, explicitly opt-in with bring-your-own API key; never enabled by default.
**Acceptance Criteria:**
- Given the day's structured summary data (already computed by `/api/history/summary`), when the user has configured an LLM API key, then a generated summary paragraph renders, clearly labeled "AI-generated."
- And with no API key configured, the feature is hidden, not broken.
**Dependencies:** `/api/history/summary`, new settings field for API key (stored like `SMTP_PASS`, never in `settings.json`).
**Implementation Notes:** the LLM only *narrates* structured data already computed deterministically — it never computes the numbers itself.

#### US-106 — AI Troubleshooting Assistant (LLM, Opt-In)
**As a** ITS **I want** a chat interface grounded in US-094's diagnostic engine output **so that** I can ask follow-up questions in natural language without the LLM inventing network facts.
**Priority:** Low · **Category:** AI/ML · **Complexity:** XL
**Type:** LLM-powered, opt-in, strictly grounded (RAG-style: the LLM is given the diagnostic engine's structured evidence as context and instructed to reason only from it).
**Acceptance Criteria:**
- Given a completed diagnostic run (US-094), when the user asks a follow-up question, then the assistant answers using only the run's evidence, and explicitly says "I don't have data for that" rather than guessing.
**Dependencies:** US-094, US-105's API-key infrastructure.
**Implementation Notes:** P3/experimental — ship after US-094 is proven reliable, not before.

#### US-107 — Root-Cause Prediction Model (Experimental)
**As a** RES **I want** a statistical ranking of "what usually precedes this event type" learned from historical diagnostic runs **so that** the system eventually anticipates problems instead of only explaining them after the fact.
**Priority:** Low · **Category:** AI/ML · **Complexity:** XL
**Type:** Statistical/experimental — explicitly not production-grade ML; a correlation-ranking research feature.
**Acceptance Criteria:**
- Given ≥90 days of diagnostic history (US-099), when a precursor-correlation report is generated, then it lists which signals most often preceded each cause type, with sample size shown so the user can judge reliability.
**Dependencies:** US-099, US-101.
**Implementation Notes:** explicitly labeled P3/Phase 8 experimental in the roadmap; requires meaningful data volume to be trustworthy.

---

### Category H — Predictive Analytics (US-108–US-112)

#### US-108 — Predicted Downtime Risk Indicator
**As a** SBU **I want** a live "risk of disconnect in the next hour" indicator based on recent instability trend **so that** I can finish an important call before it drops instead of being surprised.
**Priority:** Medium · **Category:** Predictive Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given US-053's stability index trend over the last 30 minutes, when trending sharply down, then a risk badge (Low/Elevated/High) renders with the trend driving it named.
**Dependencies:** US-053, US-101.
**Implementation Notes:** statistical trend extrapolation, not ML; explicitly labeled as an estimate.

#### US-109 — Channel Congestion Forecast
**As a** NA **I want** a trend on nearby-network count per channel **so that** I'm warned a channel is *getting* crowded before it's already bad.
**Priority:** Medium · **Category:** Predictive Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given `channels.js` history over weeks, when a channel's congestion count trends upward, then Diagnostics flags "Channel 6 congestion +40% over 2 weeks."
**Dependencies:** existing `channels.js`, needs its scans persisted over time (currently point-in-time only — add lightweight history).
**Implementation Notes:** small new rollup table for channel scan history.

#### US-110 — Signal Degradation Trend Projection
**As a** PU **I want** a projection like "at this rate, RSSI may cross your alert floor in ~5 days" **so that** I can act (move the AP, add a mesh node) before it becomes a real problem.
**Priority:** Medium · **Category:** Predictive Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given multi-week RSSI history with a statistically significant downward trend, when computed, then a projection date + confidence band renders; when the trend isn't significant, no projection is shown (avoid false alarms).
**Dependencies:** `history.js` long-range data.
**Implementation Notes:** simple linear regression with an R² significance gate.

#### US-111 — Device-Count Growth Forecast
**As a** SBU **I want** a trend of how many devices join my network over weeks/months **so that** I can plan for capacity (more APs, guest network) before it's a problem.
**Priority:** Low · **Category:** Predictive Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given historical device-count rollups, when charted monthly, then a trend line + simple linear projection renders.
**Dependencies:** `devices.js`.
**Implementation Notes:** reuses existing sighting counts.

#### US-112 — Reliability Forecast (Rolling Uptime Trend)
**As a** NA **I want** a forward-looking uptime % projection with a confidence band **so that** I have a defensible number when someone asks "how reliable is this network."
**Priority:** Low · **Category:** Predictive Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given `downtime`/event history over 90 days, when projected, then next-30-day uptime % estimate renders with an explicit confidence interval, not a false-precision single number.
**Dependencies:** existing `downtimeStat()`, event log.
**Implementation Notes:** feeds US-192 SLA tracker.

---

### Category I — Historical Analytics 2.0 (US-113–US-118)

#### US-113 — Custom Date-Range Query Builder
**As a** RES **I want** to pick an arbitrary start/end date for any chart, not just 1h/24h **so that** I can analyze a specific incident window from three weeks ago.
**Priority:** High · **Category:** Historical Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given the History section, when I pick a custom range, then `/api/history` accepts `from`/`to` params and returns bucketed data at an appropriate resolution.
**Dependencies:** existing `/api/history?range=`.
**Implementation Notes:** extend the endpoint's query parsing; add resolution auto-selection for long ranges.

#### US-114 — Day-over-Day / Week-over-Week Comparison Overlay
**As a** PWU **I want** to overlay today's metrics against the same period yesterday/last week **so that** I can tell if a slowdown is new or a recurring pattern.
**Priority:** Medium · **Category:** Historical Analytics · **Complexity:** M
**Acceptance Criteria:**
- Given two date ranges of equal length, when both are requested, then both series render on one chart with a clear visual distinction.
**Dependencies:** US-113.
**Implementation Notes:** client requests two ranges, overlays client-side.

#### US-115 — Historical Event Overlay on Charts
**As a** ITS **I want** event markers (alerts, roams, rogue-AP detections) plotted directly on history charts **so that** I can visually correlate "latency spiked right when this device joined."
**Priority:** High · **Category:** Historical Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given `/api/events` for the visible range, when a chart renders, then vertical markers appear at event timestamps, color-coded by severity, with hover detail.
**Dependencies:** existing `events.js`, `UsageHistory.jsx`.
**Implementation Notes:** Recharts `ReferenceLine`/`ReferenceDot` overlay.

#### US-116 — Availability % & Reliability Score (SLA-Style)
**As a** SBU **I want** an availability percentage over any selectable period **so that** I have a concrete number for reliability, not just a downtime-today counter.
**Priority:** Medium · **Category:** Historical Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given the event log's disconnect/reconnect pairs over a range, when computed, then uptime % renders (e.g. "99.82% over last 30 days").
**Dependencies:** existing `downtimeStat()` logic, extended to arbitrary ranges.
**Implementation Notes:** feeds US-192.

#### US-117 — Percentile Metrics Report (P50/P95/P99 over Range)
**As a** RES **I want** a percentile breakdown of latency/throughput over any date range **so that** I can characterize network quality beyond averages for a report or comparison.
**Priority:** Medium · **Category:** Historical Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given a date range, when requested, then P50/P95/P99 for latency and throughput are computed and returned.
**Dependencies:** US-113.
**Implementation Notes:** SQL percentile computation (or in-process sort for SQLite compatibility, since MySQL/SQLite percentile support differs).

#### US-118 — Historical Device Behavior Explorer
**As a** ITS **I want** a device's *entire* history across an arbitrary date range, not just recent sightings **so that** I can investigate a device's long-term pattern.
**Priority:** Low · **Category:** Historical Analytics · **Complexity:** S
**Acceptance Criteria:**
- Given a device MAC and a date range, when queried, then all sightings/events for that device in-range render on the profile page (US-070).
**Dependencies:** US-070, US-113.
**Implementation Notes:** extend `/api/devices/:mac` with range params.

---

### Category J — Network Topology 2.0 (US-119–US-122)

#### US-119 — Interactive Topology Pan/Zoom/Filter
**As a** NA **I want** to pan, zoom, and filter the existing topology map by device group/risk/category **so that** it stays usable as device count grows.
**Priority:** Medium · **Category:** Topology 2.0 · **Complexity:** M
**Acceptance Criteria:**
- Given >15 devices, when the map renders, then pan/zoom controls appear and group/category filters (US-071, US-077) narrow the visible set.
**Dependencies:** existing `NetworkTopology.jsx`.
**Implementation Notes:** client-only enhancement of the existing component.

#### US-120 — Topology Change Detection & Diff
**As a** ITS **I want** to be told what changed in my topology since yesterday (device joined/left) **so that** I don't have to eyeball the map for differences.
**Priority:** Medium · **Category:** Topology 2.0 · **Complexity:** S
**Acceptance Criteria:**
- Given yesterday's device set vs. today's, when compared, then a diff summary ("2 new, 1 not seen today") renders above the topology map.
**Dependencies:** `devices.js` sightings.
**Implementation Notes:** simple set-diff query.

#### US-121 — Topology Snapshot & Export
**As a** SBU **I want** to export the current topology as PNG/JSON **so that** I can attach it to a support ticket or documentation.
**Priority:** Low · **Category:** Topology 2.0 · **Complexity:** S
**Acceptance Criteria:**
- Given the topology view, when "Export" is clicked, then a PNG (canvas snapshot) and/or JSON (device graph) download.
**Dependencies:** existing `NetworkTopology.jsx`.
**Implementation Notes:** client-side canvas-to-PNG; JSON is just the existing device list.

#### US-122 — Device Impact Analysis
**As a** NA **I want** to click a device and see a simple statement of what it could affect (e.g. "shares this AP/band with 4 other devices") **so that** I have a rough sense of blast radius for a misbehaving device.
**Priority:** Low · **Category:** Topology 2.0 · **Complexity:** S
**Acceptance Criteria:**
- Given the LAN is a single-AP star topology (no switch-level data available), when a device is selected, then co-located devices (same band/AP) are highlighted with a plain-language note on the limits of this view.
**Dependencies:** existing topology data.
**Implementation Notes:** deliberately modest scope — this product cannot see switch-level segmentation without router access; the story is honest about that limit.

---

### Category K — Floor Plan Intelligence 2.0 (US-123–US-126)

#### US-123 — Multiple Floor Plans / Buildings Support
**As a** SBU **I want** to manage more than one floor plan (multiple floors or buildings) **so that** the feature scales past a single-apartment use case.
**Priority:** Medium · **Category:** Floor Plan 2.0 · **Complexity:** M
**Acceptance Criteria:**
- Given the existing single-plan localStorage model, when multiple plans are supported, then a plan switcher lets me create/rename/delete plans, each with its own pins.
**Dependencies:** existing `FloorPlan.jsx`.
**Implementation Notes:** key localStorage by plan ID instead of a single `STORAGE_KEY`.

#### US-124 — Dead-Zone Estimator
**As a** PU **I want** the app to interpolate my dropped RSSI pins into a coverage heatmap and flag weak regions **so that** I can see likely dead zones without manually walking every square foot.
**Priority:** Medium · **Category:** Floor Plan 2.0 · **Complexity:** L
**Acceptance Criteria:**
- Given ≥5 RSSI pins on a floor plan, when interpolated (simple inverse-distance weighting), then a heatmap overlay renders, clearly labeled "estimated from your pins, not measured continuously."
**Dependencies:** US-123, existing pin data.
**Implementation Notes:** client-side canvas interpolation; no server change.

#### US-125 — Recommended AP Placement Suggestion
**As a** PU **I want** a rough suggested spot to place a second AP/mesh node based on my weakest coverage region **so that** I have a starting point instead of guessing.
**Priority:** Low · **Category:** Floor Plan 2.0 · **Complexity:** M
**Acceptance Criteria:**
- Given US-124's dead-zone map, when computed, then a suggested marker renders at the centroid of the weakest region, explicitly labeled "non-authoritative estimate."
**Dependencies:** US-124.
**Implementation Notes:** simple centroid-of-weakest-cells heuristic — not a physics-based RF planner.

#### US-126 — Floor Plan Snapshot Comparison
**As a** PU **I want** to compare two heatmap snapshots (before/after moving my router) **so that** I can visually confirm an improvement.
**Priority:** Low · **Category:** Floor Plan 2.0 · **Complexity:** S
**Acceptance Criteria:**
- Given two saved snapshots of the same plan, when compared, then a side-by-side or diff view renders.
**Dependencies:** US-123, US-124.
**Implementation Notes:** snapshot = stored pin set + timestamp; comparison is client-side.

---

### Category L — Alert Intelligence (US-127–US-132)

#### US-127 — Alert Deduplication & Grouping
**As a** NA **I want** repeated identical alerts within a short window collapsed into one entry with a count **so that** the Alerts list isn't spammed by the same flapping issue.
**Priority:** High · **Category:** Alert Intelligence · **Complexity:** M
**Acceptance Criteria:**
- Given N identical-kind events for the same target within 5 minutes, when displayed, then they collapse into one row showing "×N" and first/last timestamp.
**Dependencies:** existing `events.js`.
**Implementation Notes:** grouping logic in the query layer; underlying rows remain intact for history.

#### US-128 — Alert Correlation Engine
**As a** ITS **I want** related alerts (e.g. rogue-AP + gateway-MAC-change within the same minute) grouped into one "situation" **so that** I see the bigger picture instead of five disconnected rows.
**Priority:** Medium · **Category:** Alert Intelligence · **Complexity:** L
**Acceptance Criteria:**
- Given a rule table of "these kinds within N seconds = one situation," when matched, then a situation card wraps the constituent events.
**Dependencies:** US-127.
**Implementation Notes:** rule-based correlation (explicit rule table), not ML.

#### US-129 — Alert Acknowledgement & Ownership
**As a** SBU **I want** to mark an alert as acknowledged (and optionally by whom, in a shared household/office) **so that** it's clear someone is already handling it.
**Priority:** Medium · **Category:** Alert Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given an alert row, when I click Acknowledge, then it's flagged with a timestamp and (optional) name, and visually deprioritized in the list.
**Dependencies:** `events.js` schema addition.
**Implementation Notes:** adds an `acknowledged_at`/`acknowledged_by` column.

#### US-130 — Alert Cooldown / Rate Limiting per Kind
**As a** PU **I want** to set a minimum interval between repeat alerts of the same kind **so that** a flapping condition doesn't push five emails in five minutes.
**Priority:** High · **Category:** Alert Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given a configured cooldown per kind in Settings, when an event of that kind would fire again inside the cooldown, then it's logged but not pushed (webhook/email).
**Dependencies:** `settings.js`, existing push logic.
**Implementation Notes:** small per-kind last-pushed timestamp map in memory.

#### US-131 — Maintenance Window Scheduler
**As a** NA **I want** to define a window during which alerts are suppressed (e.g. while I'm rebooting the router on purpose) **so that** planned work doesn't trigger a flood of false alarms.
**Priority:** Medium · **Category:** Alert Intelligence · **Complexity:** S
**Acceptance Criteria:**
- Given a scheduled or one-off maintenance window in Settings, when the current time falls inside it, then events still log but pushes (webhook/email) are suppressed with a "suppressed — maintenance window" tag.
**Dependencies:** `settings.js`.
**Implementation Notes:** simple start/end timestamp check before push.

#### US-132 — Alert Analytics Dashboard
**As a** NA **I want** stats on alert volume by kind/severity over time, and rough time-to-acknowledge **so that** I understand my network's actual pain points, not just anecdotally.
**Priority:** Low · **Category:** Alert Intelligence · **Complexity:** M
**Acceptance Criteria:**
- Given US-129's acknowledgement timestamps and the events table, when viewed, then a breakdown chart (by kind, by week) and average time-to-acknowledge render.
**Dependencies:** US-127, US-129.
**Implementation Notes:** new Alerts sub-tab, aggregate queries only.

---

### Category M — Incident Management (US-133–US-136)

#### US-133 — Manual Incident Creation from an Alert
**As a** ITS **I want** to promote one or more alerts into a tracked "incident" **so that** I can manage a real problem (e.g. a multi-hour outage) as a single unit of work.
**Priority:** Medium · **Category:** Incident Management · **Complexity:** M
**Acceptance Criteria:**
- Given one or more alert rows, when "Create Incident" is used, then a new incident record is created linking the source events, with status Open.
**Dependencies:** US-127, US-129, `db.js`.
**Implementation Notes:** new `incidents` table + join table to events.

#### US-134 — Incident Timeline & Notes
**As a** ITS **I want** to add freeform notes and see a combined timeline (linked events + notes) on an incident **so that** I have a complete record of what happened and what I tried.
**Priority:** Medium · **Category:** Incident Management · **Complexity:** S
**Acceptance Criteria:**
- Given an open incident, when I add a note, then it appears interleaved with linked events in chronological order.
**Dependencies:** US-133.
**Implementation Notes:** simple notes table keyed to incident ID.

#### US-135 — Incident Resolution & Root Cause Field
**As a** NA **I want** to close an incident with a resolution summary and root-cause tag **so that** I build a searchable record of what actually goes wrong on my network.
**Priority:** Medium · **Category:** Incident Management · **Complexity:** S
**Acceptance Criteria:**
- Given an open incident, when resolved, then status changes to Closed with required resolution text and an optional root-cause tag (can prefill from US-094's diagnosis).
**Dependencies:** US-133, US-094.
**Implementation Notes:** root-cause tag list shared with the diagnostic engine's cause taxonomy.

#### US-136 — Recurring Incident Detector
**As a** NA **I want** to be told when a new incident's root-cause tag matches prior closed incidents **so that** I recognize a chronic problem across incident boundaries, not just within one diagnostic session (US-100).
**Priority:** Low · **Category:** Incident Management · **Complexity:** S
**Acceptance Criteria:**
- Given a new incident's root-cause tag matches ≥2 prior incidents in 90 days, when created, then a "recurring" flag and links to the prior incidents render.
**Dependencies:** US-135.
**Implementation Notes:** simple tag-match query; complements US-100 at the incident (not per-run) level.

---

### Category N — Reporting (US-137–US-142)

#### US-137 — Scheduled Daily/Weekly/Monthly Report Generation
**As a** SBU **I want** reports auto-generated on a schedule and stored **so that** I have a standing record without manually pulling data.
**Priority:** High · **Category:** Reporting · **Complexity:** M
**Acceptance Criteria:**
- Given a schedule configured in Settings, when it fires, then a report record is generated from existing summary/history/event data and stored with a timestamp.
**Dependencies:** `history.js`, `events.js`, `db.js`.
**Implementation Notes:** new `reports` table; generation reuses existing summary/rollup queries — no new metrics invented.

#### US-138 — PDF Report Export
**As a** SBU **I want** to export any report as a PDF **so that** I can share it with a landlord, roommate, or ISP support rep.
**Priority:** Medium · **Category:** Reporting · **Complexity:** M
**Acceptance Criteria:**
- Given a generated report, when "Export PDF" is clicked, then a formatted PDF downloads with charts and summary text.
**Dependencies:** US-137.
**Implementation Notes:** server-side render (e.g. headless Chromium print-to-PDF of a report template) — flagged as a new dependency, justified by direct user value.

#### US-139 — Executive Summary Report
**As a** NA **I want** a one-page, non-technical summary (score + trend + top 3 issues) **so that** I can hand something readable to a non-technical stakeholder.
**Priority:** Medium · **Category:** Reporting · **Complexity:** S
**Acceptance Criteria:**
- Given US-088/US-138's health score and top diagnostic causes, when generated, then a single-page summary renders in plain language, no raw metric dumps.
**Dependencies:** US-137, US-094, US-138 (health score, referenced as the multi-dimensional score).
**Implementation Notes:** a report *template*, not new data.

#### US-140 — Security Audit Report Export
**As a** SCU **I want** a dedicated security-focused report (posture score, findings, recommendations) **so that** I can review or share my security stance specifically.
**Priority:** Medium · **Category:** Reporting · **Complexity:** S
**Acceptance Criteria:**
- Given US-088/090's security posture data, when generated, then a security-specific report template renders and exports.
**Dependencies:** US-088, US-090, US-137.
**Implementation Notes:** second report template reusing the same generation pipeline.

#### US-141 — Custom Report Builder
**As a** RES **I want** to choose which sections and date range go into a report **so that** I can build exactly the report I need instead of a fixed template.
**Priority:** Low · **Category:** Reporting · **Complexity:** M
**Acceptance Criteria:**
- Given a section picker (throughput, latency, devices, security, incidents) and a date range, when "Generate" is clicked, then only the selected sections render.
**Dependencies:** US-137, US-113.
**Implementation Notes:** report templates become composable sections rather than monolithic.

#### US-142 — Email-Delivered Reports
**As a** SBU **I want** reports emailed to me on the same schedule **so that** I don't have to remember to open the dashboard to see them.
**Priority:** Medium · **Category:** Reporting · **Complexity:** S
**Acceptance Criteria:**
- Given a report schedule and email alerts already configured, when a report generates, then it's emailed via the existing `email.js`/`nodemailer` path with the PDF attached.
**Dependencies:** US-137, US-138, existing `email.js`.
**Implementation Notes:** reuses the existing SMTP infrastructure — no new email dependency.

---

### Category O — Dashboard Customization (US-143–US-146)

#### US-143 — Multiple Named Dashboards
**As a** PWU **I want** more than one saved Overview layout (beyond the existing drag-and-drop single layout) **so that** I can switch between, e.g., a "quick glance" and a "deep dive" arrangement.
**Priority:** Medium · **Category:** Dashboard Customization · **Complexity:** M
**Acceptance Criteria:**
- Given the existing drag-and-drop layout store, when extended, then multiple named layouts can be saved, switched, and deleted.
**Dependencies:** existing Overview drag-and-drop (US-03).
**Implementation Notes:** key localStorage layout by dashboard ID instead of one fixed layout.

#### US-144 — Role-Oriented Dashboard Templates
**As a** ITS **I want** pre-built dashboard templates (Security-focused, Performance-focused, Device-focused) **so that** I don't have to build a useful layout from scratch.
**Priority:** Low · **Category:** Dashboard Customization · **Complexity:** S
**Acceptance Criteria:**
- Given US-143, when "New from template" is used, then a pre-arranged card set matching the chosen focus is created as a starting point.
**Dependencies:** US-143.
**Implementation Notes:** static template definitions referencing existing cards/components — no new widgets required.

#### US-145 — Dashboard Duplication & Save-As
**As a** PWU **I want** to duplicate an existing dashboard as a starting point for a variant **so that** I don't lose a working layout while experimenting.
**Priority:** Low · **Category:** Dashboard Customization · **Complexity:** S
**Acceptance Criteria:**
- Given a saved dashboard, when "Duplicate" is used, then a copy is created under a new name, independent of the original.
**Dependencies:** US-143.
**Implementation Notes:** simple deep-copy of the layout object.

#### US-146 — Wallboard/TV Mode Dashboard
**As a** SBU **I want** a mode that auto-rotates through multiple saved dashboards on a timer, distinct from the existing single-view Kiosk mode **so that** an office TV can show a rotating set of views instead of one fixed screen.
**Priority:** Low · **Category:** Dashboard Customization · **Complexity:** S
**Acceptance Criteria:**
- Given ≥2 saved dashboards (US-143) and a rotation interval, when Wallboard mode is enabled, then the view cycles automatically, full-screen.
**Dependencies:** US-143, existing Kiosk overlay pattern.
**Implementation Notes:** built as a thin wrapper that cycles the existing Kiosk-style full-screen rendering across multiple dashboards — explicitly distinct from the single-dashboard Kiosk mode already shipped.

---

### Category P — Search & Exploration (US-147–US-149)

#### US-147 — Global Command Palette
**As a** PWU **I want** a ⌘K command palette that searches devices, events, and settings/pages **so that** I can jump anywhere without clicking through the sidebar.
**Priority:** Medium · **Category:** Search & Exploration · **Complexity:** M
**Acceptance Criteria:**
- Given ⌘K/Ctrl+K, when pressed, then a searchable list of devices, recent events, and navigable sections/settings appears, filtering as I type.
**Dependencies:** existing routing (`App.jsx` sections), `deviceStore.js`, `events.js`.
**Implementation Notes:** client-only; indexes already-loaded data, no new endpoint required for v1.

#### US-148 — Structured Metric/Event Search
**As a** ITS **I want** to filter events by date range, kind, and severity in one query UI **so that** I can find a specific incident quickly instead of scrolling the log.
**Priority:** Medium · **Category:** Search & Exploration · **Complexity:** S
**Acceptance Criteria:**
- Given filter controls above the Alerts list, when set, then `/api/events` is queried with matching params and results update.
**Dependencies:** existing `/api/events?limit=`, extended with filter params.
**Implementation Notes:** extend the existing endpoint's query parsing.

#### US-149 — Saved Searches
**As a** NA **I want** to save a frequently-used filter combination **so that** I can re-run it in one click.
**Priority:** Low · **Category:** Search & Exploration · **Complexity:** S
**Acceptance Criteria:**
- Given a filter set from US-148, when "Save search" is used, then it's stored (localStorage) and reappears as a quick-access chip.
**Dependencies:** US-148.
**Implementation Notes:** localStorage, client-only.

---

### Category Q — Configuration & Change Management (US-150–US-152)

#### US-150 — Settings Change History / Diff Log
**As a** NA **I want** a log of every settings change (what changed, when) **so that** I can trace "when did the latency threshold get changed" months later.
**Priority:** Medium · **Category:** Configuration Management · **Complexity:** S
**Acceptance Criteria:**
- Given `PUT /api/settings`, when a change is applied, then a diff (old value → new value, timestamp) is appended to a settings-history log.
**Dependencies:** `settings.js`.
**Implementation Notes:** append-only log file or small DB table alongside `settings.json`.

#### US-151 — Settings Export/Import with Validation
**As a** SI **I want** to export the full settings JSON and import it on another install **so that** I can replicate configuration across machines.
**Priority:** Medium · **Category:** Configuration Management · **Complexity:** S
**Acceptance Criteria:**
- Given a settings export file, when imported, then values are schema-validated against `DEFAULTS` before applying, and invalid/unknown keys are rejected with a clear error.
**Dependencies:** `settings.js`.
**Implementation Notes:** validation reuses the existing `DEFAULTS` shape as the schema.

#### US-152 — Configuration Snapshot & Rollback
**As a** NA **I want** to snapshot current settings before a big change and roll back if it goes wrong **so that** I have a safety net.
**Priority:** Low · **Category:** Configuration Management · **Complexity:** S
**Acceptance Criteria:**
- Given a manual "Snapshot" action, when taken, then the current settings are stored; "Rollback to snapshot" restores them exactly.
**Dependencies:** US-150.
**Implementation Notes:** reuses the settings-history log as the snapshot store.

---

### Category R — Reliability & Self-Monitoring (US-153–US-157)

#### US-153 — Collector Health Panel
**As a** DEV **I want** to see last-success timestamp and failure count for each collector (wifi, latency, devices, etc.) **so that** I know immediately if one silently stopped working.
**Priority:** High · **Category:** Self-Monitoring · **Complexity:** M
**Acceptance Criteria:**
- Given each poll loop in `index.js`, when a collector run succeeds or throws, then a health record updates; a Settings/Diagnostics panel lists all collectors with status.
**Dependencies:** `index.js` poll loops.
**Implementation Notes:** small in-memory health map, exposed via a new `/api/health/collectors` endpoint.

#### US-154 — WebSocket Connection Health Indicator
**As a** PU **I want** a visible indicator when my browser's WebSocket connection drops/reconnects **so that** I don't mistake "the dashboard froze" for "the network is down."
**Priority:** Medium · **Category:** Self-Monitoring · **Complexity:** S
**Acceptance Criteria:**
- Given the WS client in `useLiveData.js`, when it disconnects, then a visible banner appears; when reconnected, it clears automatically.
**Dependencies:** existing `useLiveData.js`.
**Implementation Notes:** client-only, wraps the existing `ws.onclose`/`onopen` handlers.

#### US-155 — Backend Resource Usage Monitor
**As a** DEV **I want** to see the Node process's own CPU/memory/disk usage **so that** I can catch the dashboard itself becoming the problem (e.g. an unbounded log file).
**Priority:** Low · **Category:** Self-Monitoring · **Complexity:** S
**Acceptance Criteria:**
- Given `process.memoryUsage()`/`systeminformation` process stats, when polled, then a small self-monitoring card renders in Settings/Diagnostics.
**Dependencies:** existing `systeminformation` dependency (already used for throughput).
**Implementation Notes:** no new dependency required.

#### US-156 — Stale-Data Banner
**As a** PU **I want** a warning banner if a metric hasn't updated within its expected poll interval **so that** I don't stare at a frozen "everything's fine" chart during an actual outage of the collector itself.
**Priority:** High · **Category:** Self-Monitoring · **Complexity:** S
**Acceptance Criteria:**
- Given each metric's configured poll interval (`settings.js`), when no update arrives within 2× that interval, then a stale-data banner renders on the affected card.
**Dependencies:** US-153, existing poll-interval settings.
**Implementation Notes:** client-side timer per metric type, reset on each WS message.

#### US-157 — Self-Test / Health-Check Endpoint Suite
**As a** DEV **I want** an expanded `/api/health/full` that checks DB connectivity, each collector's last-success, and disk space **so that** monitoring tools (or just me) get one endpoint for overall system health.
**Priority:** Medium · **Category:** Self-Monitoring · **Complexity:** S
**Acceptance Criteria:**
- Given a GET to `/api/health/full`, when called, then it returns per-subsystem status (`db`, `collectors`, `disk`) plus overall `ok: true/false`.
**Dependencies:** US-153, `db.js`.
**Implementation Notes:** aggregates existing health signals; doesn't replace the existing lightweight `/api/health`.

---

### Category S — Data Quality (US-158–US-160)

#### US-158 — Outlier/Invalid-Sample Filter
**As a** RES **I want** obviously-invalid samples (e.g. negative latency, impossible RSSI) filtered before they're written to history **so that** my charts aren't skewed by sensor/parsing glitches.
**Priority:** Medium · **Category:** Data Quality · **Complexity:** S
**Acceptance Criteria:**
- Given a sample outside a physically plausible range, when about to be written by `history.js`, then it's rejected and logged (via `logger.js`) instead of stored.
**Dependencies:** `history.js`.
**Implementation Notes:** simple range-check gate at the write path.

#### US-159 — Data Completeness Score per Day
**As a** RES **I want** a % completeness score per day (expected samples vs. actual) **so that** I know if a chart's "flat" period is real data or a collector gap.
**Priority:** Low · **Category:** Data Quality · **Complexity:** S
**Acceptance Criteria:**
- Given poll interval and elapsed time, when computed per day, then a completeness % renders alongside the History charts.
**Dependencies:** `settings.js` poll intervals, `history.js`.
**Implementation Notes:** simple expected-vs-actual row count.

#### US-160 — Duplicate-Sample Guard
**As a** DEV **I want** duplicate-timestamp writes rejected at the DB layer **so that** a collector retry or race condition can't double-count a sample.
**Priority:** Low · **Category:** Data Quality · **Complexity:** S
**Acceptance Criteria:**
- Given the existing `ts BIGINT PRIMARY KEY` schema, when a duplicate timestamp is written, then it's an upsert/no-op, not a silent duplicate row (already partially enforced by the primary key — this story adds the same guarantee to any newer tables from this backlog).
**Dependencies:** `db.js` schema.
**Implementation Notes:** mostly a consistency/testing story ensuring new tables follow the existing primary-key pattern.

---

### Category T — Database & Data Lifecycle (US-161–US-163)

#### US-161 — Configurable Retention Tiers with Auto-Downsampling
**As a** RES **I want** raw/hourly/daily retention tiers (keep raw for 24h, hourly for 90 days, daily forever) **so that** long-term trends survive without unbounded storage growth.
**Priority:** Medium · **Category:** Data Lifecycle · **Complexity:** M
**Acceptance Criteria:**
- Given the existing `retentionHours` setting, when extended with a daily tier, then a nightly job downsamples hourly rows older than the configured window into daily rows and prunes the source.
**Dependencies:** existing `history.js` rollup job.
**Implementation Notes:** extends the existing rollup cadence one level further; no new DB engine.

#### US-162 — Manual Backup/Restore (SQLite Mode)
**As a** PU **I want** a one-click backup of my SQLite database file and a restore path **so that** I don't lose months of history to a disk issue.
**Priority:** Medium · **Category:** Data Lifecycle · **Complexity:** S
**Acceptance Criteria:**
- Given SQLite mode is active, when "Backup now" is used, then the DB file is copied with a timestamped name; "Restore" lets me pick a prior backup file.
**Dependencies:** `db.js` (SQLite path).
**Implementation Notes:** file copy operation; MySQL mode shows guidance to use standard `mysqldump` instead of reinventing it.

#### US-163 — Storage Usage Panel
**As a** DEV **I want** to see DB file size (or MySQL table sizes), row counts, and growth rate **so that** I can plan retention settings with real numbers instead of guessing.
**Priority:** Low · **Category:** Data Lifecycle · **Complexity:** S
**Acceptance Criteria:**
- Given the active DB engine, when viewed in Settings, then size, row counts per table, and a rough daily-growth estimate render.
**Dependencies:** `db.js`.
**Implementation Notes:** `fs.statSync` for SQLite; `information_schema` query for MySQL.

---

### Category U — Privacy (US-164–US-166)

#### US-164 — Local-Only Mode Toggle
**As a** SCU **I want** one master switch that hard-disables every outbound call (vendor lookup, webhook, email, speed test, any future LLM call) **so that** I can guarantee the dashboard makes zero external network calls when I want it fully offline.
**Priority:** High · **Category:** Privacy · **Complexity:** S
**Acceptance Criteria:**
- Given Local-Only Mode is enabled, when any collector or integration would make an outbound call, then it's skipped and the affected UI area shows "disabled by Local-Only Mode."
**Dependencies:** `settings.js`, touches `vendorLookup.js`, `email.js`, `speedtest.js`.
**Implementation Notes:** single settings flag checked as a guard clause at each outbound call site — no new architecture.

#### US-165 — Data Export & Full Deletion
**As a** SCU **I want** to export all my data and, separately, permanently delete all stored history/events/settings **so that** I have full control over my own local install's data.
**Priority:** Medium · **Category:** Privacy · **Complexity:** S
**Acceptance Criteria:**
- Given "Export all data," when used, then a JSON/CSV bundle of history, events, and devices downloads. Given "Delete all data," when confirmed (two-step confirmation), then all DB tables are truncated and localStorage device/floor-plan data cleared.
**Dependencies:** `db.js`, `history.js`, `events.js`.
**Implementation Notes:** destructive action — must require explicit typed confirmation, matching the app's existing care around destructive operations.

#### US-166 — MAC/IP Anonymization Mode for Exports
**As a** ITS **I want** an option to anonymize MACs/IPs (hash or mask) in exports, reports, and Kiosk/screenshots **so that** I can share a report publicly without leaking real device identifiers.
**Priority:** Low · **Category:** Privacy · **Complexity:** S
**Acceptance Criteria:**
- Given anonymization mode is on for an export/report, when generated, then MACs/IPs are replaced with stable pseudonyms (e.g. "Device A") consistent within that document.
**Dependencies:** US-137 (Reporting), US-165 (Export).
**Implementation Notes:** deterministic per-export hashing (not reversible without the original data) so the same device maps to the same pseudonym within one document.

---

### Category V — Multi-Network Support (US-167–US-169)

#### US-167 — Network Profile Switching Detection
**As a** PWU **I want** the app to auto-detect when I've joined a different SSID (home vs. office vs. coffee shop) and keep separate history per profile **so that** my home network's history isn't polluted by data from other networks.
**Priority:** High · **Category:** Multi-Network · **Complexity:** L
**Acceptance Criteria:**
- Given a change in current SSID, when detected, then a network profile is created/selected automatically, and subsequent history/events are tagged with that profile ID.
**Dependencies:** `wifiStats.js`, `db.js` schema (adds a `profile_id` to relevant tables).
**Implementation Notes:** significant but additive schema change — existing single-profile data migrates to a default profile.

#### US-168 — Per-Profile Settings & Alert Thresholds
**As a** PWU **I want** different thresholds per network profile (my office Wi-Fi is naturally noisier than home) **so that** alerts are calibrated per environment instead of one global setting.
**Priority:** Medium · **Category:** Multi-Network · **Complexity:** M
**Acceptance Criteria:**
- Given US-167's profiles, when a profile is active, then its own threshold overrides (falling back to global defaults if unset) apply.
**Dependencies:** US-167, `settings.js`.
**Implementation Notes:** settings become profile-scoped with a global-default fallback layer.

#### US-169 — Network Profile Comparison View
**As a** RES **I want** to compare aggregate stats (avg RSSI, avg latency, uptime %) across my saved profiles **so that** I can see, e.g., that my office Wi-Fi is objectively worse than home.
**Priority:** Low · **Category:** Multi-Network · **Complexity:** S
**Acceptance Criteria:**
- Given ≥2 profiles with history, when compared, then a summary table renders key metrics side by side.
**Dependencies:** US-167.
**Implementation Notes:** aggregate query filtered by `profile_id`.

---

### Category W — Integrations (US-170–US-174)

#### US-170 — Prometheus Metrics Endpoint
**As a** DEV **I want** a `/metrics` endpoint in Prometheus exposition format **so that** I can scrape this dashboard's data into my existing monitoring stack.
**Priority:** Medium · **Category:** Integrations · **Complexity:** M
**Acceptance Criteria:**
- Given `GET /metrics`, when scraped, then current RSSI, latency, loss, throughput, and device count render in valid Prometheus text format.
**Dependencies:** `latest` in-memory state in `index.js`.
**Implementation Notes:** no new dependency required — exposition format is plain text, hand-rollable without a client library.

#### US-171 — Generic Syslog Forwarder
**As a** ITS **I want** events forwarded to a syslog server **so that** they land in my existing centralized logging alongside everything else I manage.
**Priority:** Low · **Category:** Integrations · **Complexity:** M
**Acceptance Criteria:**
- Given a configured syslog host/port in Settings, when an event fires, then it's forwarded in RFC 5424 format via UDP/TCP.
**Dependencies:** `events.js`.
**Implementation Notes:** small syslog-format encoder; reuses the existing event-emit hook (same place the webhook push already lives).

#### US-172 — Grafana-Ready Data Source Documentation
**As a** DEV **I want** documented steps (and a starter dashboard JSON) for pointing Grafana at this dashboard's Prometheus endpoint (US-170) or MySQL directly **so that** I don't have to reverse-engineer the schema myself.
**Priority:** Low · **Category:** Integrations · **Complexity:** S
**Acceptance Criteria:**
- Given US-170's endpoint, when documented, then a `docs/integrations/grafana.md` with a sample dashboard JSON exists and is verified against a real Grafana instance.
**Dependencies:** US-170.
**Implementation Notes:** documentation + a static importable dashboard JSON — no code change beyond US-170 itself.

#### US-173 — OpenTelemetry Trace Emission for Diagnostic Runs
**As a** DEV **I want** each diagnostic engine run (US-094) emitted as an OpenTelemetry trace **so that** I can inspect exactly which signals were evaluated and how long each step took, in tools I already use.
**Priority:** Low · **Category:** Integrations · **Complexity:** L
**Acceptance Criteria:**
- Given OTel export is configured (endpoint in Settings), when a diagnostic run executes, then a trace with spans per evaluated signal is emitted.
**Dependencies:** US-094, `@opentelemetry/api` (new dependency, justified by direct developer value).
**Implementation Notes:** opt-in, off by default; local emission only unless a collector endpoint is explicitly configured (no silent external calls).

#### US-174 — Generic Structured Webhook Templates
**As a** SI **I want** to define a custom JSON payload template for outbound webhooks (beyond the existing Slack/Discord-shaped payload) **so that** I can feed events into Zapier, IFTTT, or my own service without a shape mismatch.
**Priority:** Medium · **Category:** Integrations · **Complexity:** S
**Acceptance Criteria:**
- Given a custom JSON template with `{{event.kind}}`-style placeholders in Settings, when an event fires and a custom webhook is configured, then the rendered payload matches the template exactly.
**Dependencies:** existing webhook push in `index.js`; complements existing US-48 (Custom Webhook Payload Template Editor UI) by supplying the generic-consumer use case, not duplicating its editor.
**Implementation Notes:** small template-string renderer; validated against injection (no `eval`).

---

### Category X — Developer Experience (US-175–US-178)

#### US-175 — OpenAPI Specification for All REST Endpoints
**As a** DEV **I want** a machine-readable OpenAPI 3.0 spec covering every existing and new REST endpoint **so that** I can generate clients, mock servers, or validate requests.
**Priority:** High · **Category:** Developer Experience · **Complexity:** M
**Acceptance Criteria:**
- Given the current REST surface, when documented, then `server/openapi.yaml` validates against the OpenAPI 3.0 schema and covers 100% of existing routes.
**Dependencies:** none beyond the existing `index.js` route table.
**Implementation Notes:** foundational for API Key auth (US-176) and any external integration — do this early (see roadmap).

#### US-176 — API Key Authentication Layer (Opt-In)
**As a** SI **I want** an opt-in API key requirement for REST/WebSocket access **so that** I can safely expose the dashboard beyond localhost (e.g. on a home LAN) without it being wide open.
**Priority:** High · **Category:** Developer Experience · **Complexity:** M
**Acceptance Criteria:**
- Given an API key is configured, when a request lacks a valid key, then it's rejected with 401; when unset (default), behavior is unchanged (localhost-trust default preserved).
**Dependencies:** `server/.env` pattern (reuses the existing secret-in-env convention, like `SMTP_PASS`).
**Implementation Notes:** off by default — this is additive security for people who choose to expose the app, not a breaking change for the current single-host use case.

#### US-177 — WebSocket Event Reference + Playground Page
**As a** DEV **I want** a documented reference of every WS message type plus a live playground to watch raw messages **so that** integrating against the WebSocket doesn't require reading `index.js`.
**Priority:** Medium · **Category:** Developer Experience · **Complexity:** S
**Acceptance Criteria:**
- Given a `/dev` route (or docs page), when opened, then every WS message type is documented with example payloads, and a live raw-stream viewer is available.
**Dependencies:** US-178 shares the raw-stream viewer component.
**Implementation Notes:** documentation-heavy; the playground reuses the same WS connection `useLiveData.js` already opens.

#### US-178 — Debug Console / Developer Panel
**As a** DEV **I want** an in-app panel showing the raw live event stream, current settings, and collector health **so that** I can debug without opening browser devtools or server logs.
**Priority:** Low · **Category:** Developer Experience · **Complexity:** S
**Acceptance Criteria:**
- Given a hidden/dev-flagged route, when opened, then raw WS messages stream in a scrollable console alongside current settings JSON and US-153's collector health.
**Dependencies:** US-153, US-177.
**Implementation Notes:** gated behind a settings flag so it isn't clutter for non-developer users.

---

### Category Y — Automation (US-179–US-182)

#### US-179 — Automation Rules Engine (Non-Destructive Actions Only)
**As a** AU **I want** simple if/then rules ("if latency-high event fires more than 3× in an hour, then send a webhook to X") built from existing events and existing actions (webhook/email) **so that** I can compose my own alerting logic without code.
**Priority:** Medium · **Category:** Automation · **Complexity:** L
**Acceptance Criteria:**
- Given a rule (trigger condition + action), when the trigger condition is met, then the configured action (webhook/email — reusing existing integrations only) fires.
- And no rule can perform a destructive or network-altering action (explicitly out of scope, matching the app's read-only/no-sudo philosophy).
**Dependencies:** `events.js`, existing webhook/email pipeline.
**Implementation Notes:** rules stored as structured JSON (trigger + action), evaluated in the existing event-emit path — deliberately not a general scripting engine.

#### US-180 — Scheduled Speed Test Runner
**As a** SBU **I want** speed tests to run automatically on a schedule (e.g. every 4 hours) instead of only on-demand **so that** I build a real historical record of my ISP's actual delivered speed.
**Priority:** Medium · **Category:** Automation · **Complexity:** S
**Acceptance Criteria:**
- Given a schedule in Settings, when it fires, then `POST /api/speedtest/run` executes automatically and results are stored in history like any other sample.
**Dependencies:** existing `speedtest.js`, `POST /api/speedtest/run`.
**Implementation Notes:** a scheduled trigger calling the existing endpoint's logic — no new speed-test mechanism.

#### US-181 — Scheduled Diagnostic Scan
**As a** PU **I want** the root-cause diagnostic engine (US-094) to run automatically overnight and summarize any issues found **so that** I wake up to a morning summary instead of finding out my Wi-Fi was bad at 2am after the fact.
**Priority:** Medium · **Category:** Automation · **Complexity:** S
**Acceptance Criteria:**
- Given a nightly schedule, when it fires, then the diagnostic engine runs against the last 24h and a summary is available in the morning (surfaces via US-105's daily summary if enabled, or a plain notification otherwise).
**Dependencies:** US-094.
**Implementation Notes:** scheduled invocation of the existing engine, not a new analysis path.

#### US-182 — Automation Run History / Audit Log
**As a** AU **I want** a log of every automation rule firing (what triggered, what action ran, when) **so that** I can debug my own rules and trust what the system did on its own.
**Priority:** Low · **Category:** Automation · **Complexity:** S
**Acceptance Criteria:**
- Given US-179's rules engine, when any rule fires, then an entry is appended to an automation audit log, visible in Settings.
**Dependencies:** US-179.
**Implementation Notes:** append-only log, same pattern as US-150's settings-change log.

---

### Category Z — UX / Accessibility (US-183–US-185)

#### US-183 — Full Keyboard Navigation & Focus Management
**As a** PU **I want** every interactive element reachable and operable via keyboard alone **so that** I'm not dependent on a mouse/trackpad.
**Priority:** Medium · **Category:** Accessibility · **Complexity:** M
**Acceptance Criteria:**
- Given the full app, when navigated via Tab/Shift+Tab/Enter/Escape only, then every action (nav, modals, forms, US-147's command palette) is reachable with a visible focus ring.
**Dependencies:** existing component library (`components/ui/primitives.jsx`).
**Implementation Notes:** primarily an audit-and-fix pass on the existing primitives, not new components.

#### US-184 — Screen-Reader Labels & WCAG 2.1 AA Audit Pass
**As a** PU **I want** proper ARIA labels and a passing WCAG 2.1 AA audit **so that** the dashboard is usable with assistive technology.
**Priority:** Medium · **Category:** Accessibility · **Complexity:** M
**Acceptance Criteria:**
- Given an automated audit tool (e.g. axe-core) run against every section, when run, then zero critical/serious violations remain.
**Dependencies:** US-183.
**Implementation Notes:** add axe-core as a dev-only dependency for CI checks, not shipped to production.

#### US-185 — Reduced-Motion & High-Contrast Modes
**As a** PU **I want** to disable animations and increase contrast **so that** the UI works for my sensory preferences/needs.
**Priority:** Low · **Category:** Accessibility · **Complexity:** S
**Acceptance Criteria:**
- Given `prefers-reduced-motion` or an explicit Settings toggle, when enabled, then transitions/animations are removed and a high-contrast theme variant is selectable.
**Dependencies:** existing theme system (light/dark/OLED/cyberpunk/emerald).
**Implementation Notes:** CSS-only for reduced motion; high-contrast is a new theme variant following the existing theme-class pattern.

---

### Category AA — Onboarding (US-186–US-188)

#### US-186 — First-Run Setup Wizard
**As a** PU **I want** a guided first-run flow (permissions explanation, ping-host choice, initial baseline warm-up) **so that** I understand what the app needs and why before I'm dropped into a dashboard of numbers.
**Priority:** High · **Category:** Onboarding · **Complexity:** M
**Acceptance Criteria:**
- Given no prior settings exist, when the app first loads, then a wizard explains macOS Location-Services/SSID redaction (already documented in the README), lets me set ping host/thresholds, and explains that baselines (US-101) take ~7 days to mature.
**Dependencies:** `settings.js`, README's existing macOS notes (reused as content, not re-derived).
**Implementation Notes:** UI-only; sets the same settings fields that already exist.

#### US-187 — Guided Alert & Integration Setup
**As a** PU **I want** a guided flow to configure webhook/email during onboarding, with a one-click test **so that** I know alerts actually work before I need them.
**Priority:** Medium · **Category:** Onboarding · **Complexity:** S
**Acceptance Criteria:**
- Given the wizard's alerting step, when I enter webhook/email details, then the existing test-email/test-webhook actions run inline with pass/fail feedback.
**Dependencies:** US-186, existing `/api/email/test`.
**Implementation Notes:** wraps existing test endpoints in the wizard flow.

#### US-188 — Sample/Demo Data Mode
**As a** SI **I want** a demo mode with realistic synthetic data **so that** I can evaluate or showcase the UI without live Wi-Fi hardware.
**Priority:** Low · **Category:** Onboarding · **Complexity:** M
**Acceptance Criteria:**
- Given Demo Mode is enabled, when active, then all collectors are replaced with a synthetic data generator producing plausible values, clearly banner-labeled "Demo Data — not live."
**Dependencies:** collector interfaces (swap implementation behind the existing collector abstraction).
**Implementation Notes:** useful for screenshots, onboarding previews, and this very backlog's own future demos.

---

### Category BB — Network Baseline & Health Score 2.0 (US-189–US-191)

#### US-189 — Formal Baseline Engine
**As a** PWU **I want** the system to formally track "normal" ranges per metric (not just implicitly via US-101's statistics, but as a queryable, user-visible concept) **so that** baselines are a first-class feature I can inspect and trust, not a hidden implementation detail.
**Priority:** Critical · **Category:** Baseline & Health Score 2.0 · **Complexity:** M
**Acceptance Criteria:**
- Given US-101's underlying statistics, when exposed, then a Settings/Diagnostics panel shows "your normal ranges" per metric, per time-of-day bucket, in plain units.
**Dependencies:** US-101 (this is the user-facing surface of that engine).
**Implementation Notes:** thin UI/API layer over US-101 — deliberately not a separate computation.

#### US-190 — Health Score 2.0 — Multi-Dimensional Transparent Score
**As a** PU **I want** the existing single health gauge evolved into dimensions (Wi-Fi quality, Internet quality, LAN quality, DNS quality, Stability, Security, Device health) each with current score, trend, and contributing factors **so that** "82/100" actually tells me *what's* wrong, not just *that* something is.
**Priority:** Critical · **Category:** Baseline & Health Score 2.0 · **Complexity:** L
**Acceptance Criteria:**
- Given the existing `HealthGauge.jsx` overall score, when evolved, then it decomposes into the seven dimensions above, each independently trended, with an explicit confidence indicator once US-189 has enough baseline data.
- And the overall score remains a weighted roll-up of the dimensions, not a separate calculation, so it doesn't diverge from what's already shipped.
**Dependencies:** existing `HealthGauge.jsx`, US-088 (security dimension), US-073 (device dimension), US-189.
**Implementation Notes:** this explicitly **evolves** the shipped health score rather than duplicating it — the existing single number becomes the roll-up of these dimensions.

#### US-191 — Baseline Deviation Explainer
**As a** PU **I want** every alert to state whether the triggering value is actually abnormal *for me* ("RSSI is -72, which is your normal range — alert threshold is generic, consider raising it") **so that** I trust alerts more and get a nudge toward US-104's threshold recommendations.
**Priority:** Medium · **Category:** Baseline & Health Score 2.0 · **Complexity:** S
**Acceptance Criteria:**
- Given an alert fires from a static threshold (existing behavior) and US-189's baseline says the value is within the user's normal range, when displayed, then the alert includes a "this is normal for you" note linking to US-104.
**Dependencies:** US-189, US-104.
**Implementation Notes:** annotation layer on existing alert rendering — doesn't change when alerts fire, only how they're explained.

---

### Category CC — Business-Level / SLA Features (US-192–US-194)

#### US-192 — Uptime/Availability SLA Tracker
**As a** SBU **I want** MTTR, MTBF, and availability % computed from my *actual* event log **so that** I have honest, locally-measured reliability numbers — not a claim of enterprise infrastructure this product doesn't have.
**Priority:** Medium · **Category:** Business/SLA · **Complexity:** M
**Acceptance Criteria:**
- Given the existing disconnect/reconnect event pairs, when computed over a selectable period, then MTTR (mean time to recovery), MTBF (mean time between failures), and availability % render with the underlying incident count shown.
**Dependencies:** existing `downtimeStat()`/event log, US-116.
**Implementation Notes:** purely derived from data already collected — explicitly not claiming multi-node/enterprise SLA infrastructure.

#### US-193 — Monthly Executive Summary (SLA-Flavored)
**As a** SBU **I want** a monthly summary combining US-139's executive report with US-192's SLA numbers **so that** I have one document for "how did the network do this month" conversations.
**Priority:** Low · **Category:** Business/SLA · **Complexity:** S
**Acceptance Criteria:**
- Given US-137's scheduled reports and US-192's SLA data, when a monthly report generates, then SLA figures are included alongside the existing executive-summary content.
**Dependencies:** US-139, US-192.
**Implementation Notes:** a report-template composition, not new computation.

#### US-194 — Service-Level Objective (SLO) Configuration
**As a** SBU **I want** to set my own targets (e.g. 99.5% uptime, 50ms P95 latency) and see pass/fail against them **so that** "good enough" is defined by me, not a generic default.
**Priority:** Low · **Category:** Business/SLA · **Complexity:** S
**Acceptance Criteria:**
- Given configurable SLO targets in Settings, when US-192/US-117's actual figures are computed, then a pass/fail/at-risk badge renders against each configured SLO.
**Dependencies:** US-192, US-117.
**Implementation Notes:** simple threshold comparison against already-computed figures.

---

## Priority Matrix

Business Value / User Impact: **VH** (Very High) · **H** · **M** · **L**. Technical Complexity mirrors each story's S/M/L/XL. Risk reflects technical + trust risk (e.g. AI features carry explainability risk even when technically simple). Priority follows P0 (Foundation/Critical) → P3 (Experimental), independent of the per-story Critical/High/Medium/Low field above (P-tier accounts for sequencing, not just value).

| Story | Business Value | User Impact | Complexity | Risk | Priority |
|---|---|---|---|---|---|
| US-053 | H | H | M | L | P1 |
| US-054 | H | M | M | L | P1 |
| US-055 | M | M | S | L | P2 |
| US-056 | H | H | L | M | P1 |
| US-057 | H | H | M | L | P1 |
| US-058 | M | M | M | L | P2 |
| US-059 | M | L | S | L | P2 |
| US-060 | L | L | S | L | P3 |
| US-061 | M | M | M | L | P2 |
| US-062 | M | M | M | L | P2 |
| US-063 | M | M | M | L | P2 |
| US-064 | H | H | S | L | P1 |
| US-065 | L | L | L | M | P3 |
| US-066 | H | H | S | L | P0 |
| US-067 | H | H | S | L | P0 |
| US-068 | VH | VH | L | M | P0 |
| US-069 | L | L | M | L | P3 |
| US-070 | H | H | M | L | P1 |
| US-071 | M | M | S | L | P2 |
| US-072 | H | M | M | L | P1 |
| US-073 | M | M | M | L | P2 |
| US-074 | H | H | M | M | P1 |
| US-075 | H | H | S | L | P1 |
| US-076 | H | H | S | L | P1 |
| US-077 | M | M | S | L | P2 |
| US-078 | L | L | M | L | P3 |
| US-079 | M | M | S | L | P2 |
| US-080 | M | M | S | L | P2 |
| US-081 | L | L | S | L | P3 |
| US-082 | H | H | M | M | P1 |
| US-083 | L | L | S | L | P3 |
| US-084 | M | M | S | L | P2 |
| US-085 | H | H | M | M | P1 |
| US-086 | VH | VH | M | M | P0 |
| US-087 | M | M | XL | H | P3 |
| US-088 | H | H | M | L | P1 |
| US-089 | M | M | S | L | P2 |
| US-090 | M | M | M | L | P2 |
| US-091 | M | M | S | L | P2 |
| US-092 | H | H | M | M | P1 |
| US-093 | M | M | S | L | P2 |
| US-094 | VH | VH | XL | M | P0 |
| US-095 | H | H | M | L | P0 |
| US-096 | M | M | M | L | P2 |
| US-097 | H | H | S | L | P1 |
| US-098 | M | M | M | L | P2 |
| US-099 | M | M | S | L | P1 |
| US-100 | M | M | M | L | P2 |
| US-101 | VH | VH | L | M | P0 |
| US-102 | H | H | M | M | P1 |
| US-103 | M | M | L | M | P2 |
| US-104 | H | H | M | L | P1 |
| US-105 | M | M | L | M | P3 |
| US-106 | L | M | XL | H | P3 |
| US-107 | L | L | XL | H | P3 |
| US-108 | M | M | M | M | P2 |
| US-109 | M | M | S | L | P2 |
| US-110 | M | M | M | M | P2 |
| US-111 | L | L | S | L | P3 |
| US-112 | L | L | M | M | P3 |
| US-113 | H | H | M | L | P1 |
| US-114 | M | M | M | L | P2 |
| US-115 | H | H | S | L | P1 |
| US-116 | M | M | S | L | P2 |
| US-117 | M | M | S | L | P2 |
| US-118 | L | L | S | L | P3 |
| US-119 | M | M | M | L | P2 |
| US-120 | M | M | S | L | P2 |
| US-121 | L | L | S | L | P3 |
| US-122 | L | L | S | L | P3 |
| US-123 | M | M | M | L | P2 |
| US-124 | M | H | L | M | P2 |
| US-125 | L | M | M | M | P3 |
| US-126 | L | L | S | L | P3 |
| US-127 | H | H | M | L | P1 |
| US-128 | M | M | L | M | P2 |
| US-129 | M | M | S | L | P2 |
| US-130 | H | H | S | L | P1 |
| US-131 | M | M | S | L | P2 |
| US-132 | L | L | M | L | P3 |
| US-133 | M | M | M | L | P2 |
| US-134 | M | M | S | L | P2 |
| US-135 | M | M | S | L | P2 |
| US-136 | L | L | S | L | P3 |
| US-137 | H | H | M | L | P1 |
| US-138 | M | M | M | M | P2 |
| US-139 | M | M | S | L | P2 |
| US-140 | M | M | S | L | P2 |
| US-141 | L | L | M | L | P3 |
| US-142 | M | M | S | L | P2 |
| US-143 | M | M | M | L | P2 |
| US-144 | L | L | S | L | P3 |
| US-145 | L | L | S | L | P3 |
| US-146 | L | L | S | L | P3 |
| US-147 | M | M | M | L | P2 |
| US-148 | M | M | S | L | P2 |
| US-149 | L | L | S | L | P3 |
| US-150 | M | M | S | L | P2 |
| US-151 | M | M | S | L | P2 |
| US-152 | L | L | S | L | P3 |
| US-153 | H | H | M | L | P0 |
| US-154 | M | M | S | L | P1 |
| US-155 | L | L | S | L | P3 |
| US-156 | H | H | S | L | P0 |
| US-157 | M | M | S | L | P1 |
| US-158 | M | M | S | L | P1 |
| US-159 | L | L | S | L | P3 |
| US-160 | L | L | S | L | P2 |
| US-161 | M | M | M | M | P1 |
| US-162 | M | M | S | L | P2 |
| US-163 | L | L | S | L | P3 |
| US-164 | H | H | S | L | P0 |
| US-165 | M | M | S | M | P1 |
| US-166 | L | L | S | L | P3 |
| US-167 | H | H | L | M | P1 |
| US-168 | M | M | M | L | P2 |
| US-169 | L | L | S | L | P3 |
| US-170 | M | M | M | L | P2 |
| US-171 | L | L | M | L | P3 |
| US-172 | L | L | S | L | P3 |
| US-173 | L | M | L | M | P3 |
| US-174 | M | M | S | L | P2 |
| US-175 | H | M | M | L | P0 |
| US-176 | H | H | M | M | P1 |
| US-177 | M | M | S | L | P2 |
| US-178 | L | L | S | L | P3 |
| US-179 | M | H | L | M | P2 |
| US-180 | M | M | S | L | P1 |
| US-181 | M | M | S | L | P2 |
| US-182 | L | L | S | L | P3 |
| US-183 | M | H | M | L | P1 |
| US-184 | M | M | M | L | P2 |
| US-185 | L | M | S | L | P2 |
| US-186 | H | H | M | L | P1 |
| US-187 | M | M | S | L | P2 |
| US-188 | L | L | M | L | P3 |
| US-189 | VH | H | M | M | P0 |
| US-190 | VH | VH | L | M | P0 |
| US-191 | M | M | S | L | P1 |
| US-192 | M | M | M | L | P2 |
| US-193 | L | L | S | L | P3 |
| US-194 | L | L | S | L | P3 |

---

## Technical Feasibility Matrix

✅ = yes/required · ➖ = no/not required. Grouped by category for readability (full per-story `Dependencies`/`Implementation Notes` fields above already carry story-specific nuance).

| Category | Locally Possible | Requires Router | Requires External API | Requires Elevated Permission | Complexity Range |
|---|---|---|---|---|---|
| A. Real-Time Analytics | ✅ | ➖ | ➖ | ➖ | S–M |
| B. Network Performance Intelligence | ✅ | ➖ | ➖ | ➖ | S–M |
| C. Device Intelligence 2.0 | ✅ | ➖ | ➖ | ➖ | S–M |
| D. Bandwidth & Resource Intelligence | ✅ (host-only) | ✅ (per-device tier, US-083 only) | ➖ | ➖ | S |
| E. Advanced Security & Threat Monitoring | ✅ (US-085/086/088–093) | ➖ | ➖ | ✅ (US-087 only) | M–XL |
| F. Intelligent Diagnostics Engine | ✅ | ➖ | ➖ | ➖ | M–XL |
| G. AI / Machine Learning | ✅ (US-101–104, US-107) | ➖ | ✅ (US-105, US-106 only) | ➖ | L–XL |
| H. Predictive Analytics | ✅ | ➖ | ➖ | ➖ | S–M |
| I. Historical Analytics 2.0 | ✅ | ➖ | ➖ | ➖ | S–M |
| J. Network Topology 2.0 | ✅ | ➖ | ➖ | ➖ | S–M |
| K. Floor Plan Intelligence 2.0 | ✅ | ➖ | ➖ | ➖ | S–L |
| L. Alert Intelligence | ✅ | ➖ | ➖ | ➖ | S–L |
| M. Incident Management | ✅ | ➖ | ➖ | ➖ | S–M |
| N. Reporting | ✅ | ➖ | ➖ | ➖ | S–M |
| O. Dashboard Customization | ✅ | ➖ | ➖ | ➖ | S–M |
| P. Search & Exploration | ✅ | ➖ | ➖ | ➖ | S–M |
| Q. Configuration & Change Management | ✅ | ➖ | ➖ | ➖ | S |
| R. Reliability & Self-Monitoring | ✅ | ➖ | ➖ | ➖ | S–M |
| S. Data Quality | ✅ | ➖ | ➖ | ➖ | S |
| T. Database & Data Lifecycle | ✅ | ➖ | ➖ | ➖ | S–M |
| U. Privacy | ✅ | ➖ | ➖ | ➖ | S |
| V. Multi-Network Support | ✅ | ➖ | ➖ | ➖ | S–L |
| W. Integrations | ✅ | ➖ | ➖ (local emission by default) | ➖ | S–L |
| X. Developer Experience | ✅ | ➖ | ➖ | ➖ | S–M |
| Y. Automation | ✅ | ➖ | ➖ | ➖ | S–L |
| Z. UX / Accessibility | ✅ | ➖ | ➖ | ➖ | S–M |
| AA. Onboarding | ✅ | ➖ | ➖ | ➖ | S–M |
| BB. Baseline & Health Score 2.0 | ✅ | ➖ | ➖ | ➖ | S–L |
| CC. Business-Level / SLA | ✅ | ➖ | ➖ | ➖ | S–M |

**Two categories carry the only real infrastructure asterisks in this entire backlog:** Category D's per-device bandwidth ceiling (US-083, explicitly scaffolding-only) and Category E's US-087 (rogue-DHCP detection, the one story requiring packet capture). Every other one of the 142 stories runs on data this product can already collect today.

---

## Dependency Graph

```text
Statistical Baseline Engine (US-101)
     ↓
Anomaly Detection Service (US-102) ──→ Live Anomaly Badges (US-057)
     ↓                                          ↓
Auto Threshold Recommendation (US-104)   Bandwidth Anomaly Alert (US-082)
     ↓
Baseline Deviation Explainer (US-191)
     ↓
Health Score 2.0 (US-190) ←── Security Posture Score (US-088)
     ↓                        ←── Device Reliability/Risk (US-073, US-074)
Executive/SLA Reporting (US-139, US-192, US-193)
```

```text
Gateway RTT Isolation (US-066) + Internet/LAN Split (US-067)
     ↓
Rule-Based Bottleneck Classifier (US-068)
     ↓
Root-Cause Diagnostic Engine (US-094)
     ↓
Evidence Narrative (US-095) + Confidence (US-096) + Remediation (US-097)
     ↓
Diagnostic History (US-099) → Recurring Problem Detector (US-100)
     ↓
Optional: AI Troubleshooting Assistant (US-106, LLM-grounded on this engine's output)
```

```text
Event Deduplication (US-127)
     ↓
Alert Correlation (US-128)
     ↓
Incident Creation (US-133) → Timeline/Notes (US-134) → Resolution (US-135)
     ↓
Recurring Incident Detector (US-136)
```

```text
Collector Health (US-153) + Stale-Data Detection (US-156)
     ↓
Self-Test Endpoint Suite (US-157)
     ↓
(Foundation for trusting every other story's data — nothing above this line
 is trustworthy if the collectors themselves aren't observably healthy.)
```

```text
OpenAPI Spec (US-175)
     ↓
API Key Auth (US-176)
     ↓
Prometheus Endpoint (US-170) → Grafana docs (US-172)
     ↓
Automation Rules Engine (US-179, actions limited to existing webhook/email)
```

---

## Top 20 Features

Selected for the combination of user problem solved, feasibility, and how many downstream stories they unlock (per the dependency graph above).

1. **US-068 — Rule-Based Network Bottleneck Identifier.** Directly answers "is it Wi-Fi, LAN, gateway, ISP, or DNS" — the single most-asked implicit question of the whole product. Fully local, no new infra. Unlocks the entire diagnostics category. **Phase 3.**
2. **US-094 — Root-Cause Diagnostic Engine.** Turns five separate charts into one explainable answer. Highest business value in the backlog; everything in Category F depends on it. **Phase 3.**
3. **US-101 — Statistical Baseline Learning Engine.** Foundation for six other stories (thresholds, anomaly detection, health score, deviation explanations). Build once, reuse everywhere. **Phase 3.**
4. **US-190 — Health Score 2.0 (Multi-Dimensional).** Evolves the one thing every persona already looks at first; makes the existing gauge honest instead of opaque. **Phase 3.**
5. **US-153 — Collector Health Panel.** Nothing else in this backlog is trustworthy if a collector can silently die and nobody notices. Cheap, foundational. **Phase 3.**
6. **US-156 — Stale-Data Banner.** Prevents the single worst trust failure mode: a frozen dashboard that looks fine. **Phase 3.**
7. **US-086 — Gateway Impersonation Alert.** Highest-severity security gap not already covered by US-15/US-20 — catches MITM against the router itself, using only `arp -a` the app already runs. **Phase 4.**
8. **US-088 — Security Posture Score.** Gives security-conscious users one number to track, composed entirely from data already collected. **Phase 4.**
9. **US-102 — Anomaly Detection Service.** Statistical, explainable, and the direct prerequisite for noise suppression and predictive stories. **Phase 5.**
10. **US-104 — Automatic Threshold Recommendation.** Fixes the real weakness of static `signalFloor`/`latencyCeiling` defaults without requiring the user to understand their own baseline manually. **Phase 5.**
11. **US-127 — Alert Deduplication & Grouping.** The single highest-leverage fix for alert fatigue, which otherwise undermines every other alerting feature (existing and new). **Phase 4.**
12. **US-137 — Scheduled Report Generation.** Turns the dashboard from "something I check" into "something that reaches me." Prerequisite for six other Reporting-category stories. **Phase 7.**
13. **US-164 — Local-Only Mode Toggle.** Table-stakes trust feature for a privacy-conscious or security-conscious audience; cheap to build, high credibility payoff. **Phase 4.**
14. **US-175 — OpenAPI Specification.** Unlocks API Key Auth, safe LAN exposure, and every external integration story. Nearly free (documents what already exists). **Phase 6.**
15. **US-176 — API Key Authentication.** The one thing standing between "useful on my LAN" and "actually gets exposed and someone finds it." **Phase 6.**
16. **US-070 — Device Profile Page.** The natural landing page for six other Device Intelligence stories (behavior timeline, reliability, risk score). **Phase 3.**
17. **US-167 — Network Profile Switching Detection.** Fixes a real correctness problem (laptop history conflating home/office) that undermines every historical/baseline feature for the Power User and IT Support personas. **Phase 5.**
18. **US-066/067 — Gateway RTT Isolation + Internet/LAN Split View.** Small, cheap, and the direct evidentiary input to the bottleneck classifier (#1 above) — ship together. **Phase 3.**
19. **US-179 — Automation Rules Engine.** Extends value of every alert/event story without inventing new destructive capability — pure composition of things that already exist (events → webhook/email). **Phase 6.**
20. **US-115 — Historical Event Overlay on Charts.** Small effort, immediately makes every existing history chart more useful by showing *why* a spike happened, not just that it did. **Phase 3.**

---

## Recommended Roadmap

### Phase 3 — Advanced Observability
Core correlation and self-trust layer: US-053, US-054, US-064, US-066–068, US-070, US-072, US-094–100, US-101, US-113, US-115, US-153, US-156, US-157, US-189, US-190, US-191.
*Theme: make existing data explainable and trustworthy before adding anything new to collect.*

### Phase 4 — Security Intelligence
US-074–076, US-085, US-086, US-088–093, US-127, US-130, US-164.
*Theme: close the real security gaps beyond rogue-AP (already shipped), and fix alert fatigue at the same time so security alerts actually get read.*

### Phase 5 — Intelligent Analytics
US-055–060 (remaining), US-061–063, US-069, US-102–104, US-108–112, US-114, US-116–126, US-128, US-129, US-131, US-132, US-165–169.
*Theme: baselines mature into anomaly detection and forecasting; multi-network correctness (US-167) belongs here because baselines are meaningless if they blend two different networks' data.*

### Phase 6 — Automation & Integrations
US-133–136, US-147–152, US-170–182.
*Theme: API-first (OpenAPI → API keys) before any external integration; automation strictly composed from existing actions.*

### Phase 7 — Professional Platform
US-137–146, US-183–188, US-192–194.
*Theme: reporting, dashboard customization, accessibility, and SLA framing — this is the phase that makes the product credible to hand to someone else (a roommate, a client, a landlord).*

### Phase 8 — Experimental / AI
US-065, US-087, US-105, US-106, US-107, US-173.
*Theme: everything here is either genuinely experimental (statistical correlation ranking, LLM narration/assistant) or requires stepping outside the app's current no-elevated-permission posture (US-087) — ship last, ship opt-in, ship loudly labeled.*

---

## Kill / Keep / Invest Analysis

### INVEST
- **US-068 Bottleneck Classifier / US-094 Diagnostic Engine / US-101 Baseline Engine / US-190 Health Score 2.0** — these four are the product's actual differentiation. Everything else in this backlog either feeds them or consumes their output.
- **US-153/156/157 Self-Monitoring** — disproportionately cheap relative to the trust they buy; a dashboard that can silently go stale is worse than no dashboard.

### KEEP
- Categories C, I, J, K, L, N, O (Device Intelligence, Historical Analytics, Topology, Floor Plan, Alert Intelligence, Reporting, Dashboard Customization) — solid, expected evolution of shipped features. Build steadily, no urgency to rush.

### DEFER
- **US-087 Suspicious DHCP Monitor** — real value, but it's the only story requiring packet capture/elevated permission in the whole backlog. Defer until there's a clean, explicit, user-consented privilege-escalation UX pattern to build it on — don't bolt it onto the existing no-sudo architecture as an afterthought.
- **US-106 AI Troubleshooting Assistant / US-107 Root-Cause Prediction Model** — genuinely valuable eventually, but both are only as good as US-094's diagnostic engine and US-099's historical run volume, respectively. Building either before those mature risks an LLM confidently narrating a rule engine that isn't trustworthy yet, or a "prediction" model trained on too little data to mean anything.
- **US-167 Multi-Network Support** — high value but a real schema migration (adds `profile_id` everywhere). Worth doing, but batch it deliberately rather than retrofitting piecemeal.

### KILL (or explicitly scope down)
- **True per-device router bandwidth as anything other than US-083's honest "not connected" scaffold.** The existing README already correctly marks this Phase 3/stretch and gated on router-admin access this product doesn't have — don't let any Bandwidth Intelligence story quietly promise data the collectors can't produce.
- **True packet-level retransmission counting (beyond US-065's connect-retry proxy).** Requires packet capture; the proxy metric captures 80% of the value at 5% of the risk/complexity. Don't chase the full version without a clear elevated-permission strategy first.
- **Switch-level / VLAN-aware topology.** US-122 deliberately scopes topology impact-analysis down to what a single-AP, no-router-access LAN view can actually show. A "VLAN visualization" story was in-scope per the original brief's Category 14 prompt, but this product has no way to see VLANs without router integration — including it would have been exactly the kind of unrealistic-measurement story Section 41 explicitly warns against.
- **Full enterprise SLA/multi-node infrastructure framing.** US-192–194 keep SLA language honest by deriving strictly from this single host's own event log — anything implying multi-node aggregation or enterprise-grade SLA guarantees would misrepresent what a one-machine local dashboard can promise.

---

## Architecture Evolution Recommendations

- **Keep the collector/lib/index.js separation exactly as-is.** Every new capability above is either (a) a new file in `server/collectors/` or `server/lib/` following the existing single-responsibility pattern, or (b) a derived/aggregation layer over existing collectors (e.g. US-068's classifier reads from wifi/latency/dns/channels, it doesn't replace them).
- **Introduce one new concept carefully: a "derived signals" layer** (`server/lib/derived/` — baseline.js, anomalies.js, diagnostics.js) sitting above the raw collectors and below the event pipeline. This is where US-101, US-102, US-068, US-094 live. It's the one structural addition this backlog needs; everything else fits the current layout.
- **The event pipeline (`events.js` + `emitEvent`) stays the single choke point** for anything that becomes an alert — new detectors (US-085, US-086, US-093, US-102) call into it exactly like existing detectors do in `index.js`'s `handleWifi`. Don't build a second alerting path.

## Database Evolution Recommendations

- New tables follow the existing dual MySQL/SQLite pattern in `db.js`: `diagnostics` (US-099), `incidents` + `incident_events` + `incident_notes` (Category M), `baselines` (US-101), `reports` (US-137), `network_profiles` (US-167, additive `profile_id` column on existing tables with a default-profile backfill migration).
- **Retention tiering (US-161)** extends the existing hourly-rollup job one level further (add a daily tier) rather than introducing a new aggregation mechanism.
- **No new database engine.** Every story here fits MySQL or SQLite; nothing in this backlog needs a time-series-specialized store, a graph database, or a vector database (even US-106's LLM assistant is grounded via prompt context, not vector retrieval, given the product's data volume).

## API Evolution Recommendations

- **US-175 (OpenAPI spec) should happen essentially first** among the Phase 6 work — it costs almost nothing (documents what exists) and is the prerequisite for API keys, external integrations, and any SDK/client generation.
- New endpoints are additive and namespaced consistently with existing conventions: `/api/diagnostics/*` gains `/api/diagnostics/run`, `/api/diagnostics/history`; `/api/devices/:mac` for profiles; `/api/incidents/*`; `/api/reports/*`; `/metrics` for Prometheus (US-170) as the one deliberate exception to the `/api/*` prefix, matching Prometheus convention.
- **US-176's API key auth is opt-in and additive** — the existing localhost-trust model for the current single-user, single-host deployment is preserved by default; nothing in this backlog should force auth on an install that doesn't want it.

## WebSocket Event Evolution

- New message types are additive, following the existing `{ type, data, timestamp }` envelope: `anomaly` (US-057/102), `diagnostic-result` (US-094 live push when a run completes), `collector-health` (US-153).
- **No existing message type's shape changes** — e.g. US-085's `wifi` payload extension (`rogueAccessPoints`, already shipped) is the model: additive fields, never breaking ones.

## UI / UX Evolution

- Diagnostics section gains the root-cause engine (US-094–100) as its centerpiece — currently Diagnostics is a collection of independent tools (channels, DNS, traceroute, BSSID, SNR, band-steering); this backlog gives it a synthesizing "why" view that ties the existing tools together as evidence sources.
- Alerts section gains lifecycle (ack/group/correlate/incident) without changing the existing event-log foundation — it becomes a richer view over the same table, not a new subsystem.
- A new top-level concept, **Reports**, joins the seven existing sections as an eighth navigable area once US-137+ ship.

## Security Considerations

- Every new detector in Category E is **read-only and passive** — no active probing of other devices, no port scanning of neighbors, no credential testing. This preserves the existing product's defensive-only posture.
- US-176 (API key auth) and US-164 (Local-Only Mode) are the two stories that most directly affect the product's own attack surface as it evolves beyond "trusted single-user localhost app" — treat them as prerequisites, not afterthoughts, for any Phase 6+ integration work that exposes new surface area.
- US-087 is the sole story requiring elevated permission in this entire backlog; it must ship with an explicit, visible consent flow — never silently escalate.

## Performance Considerations

- The derived-signals layer (baseline/anomaly/diagnostics) must run **off the hot poll-loop path** — compute on a slower cadence (e.g. once per minute or on-demand) so it never adds latency to the existing 2–5 second live-metric polling that the whole real-time UI depends on.
- Retention tiering (US-161) exists specifically to keep query performance flat as history grows — without it, several Historical Analytics 2.0 stories (US-113, US-117) would degrade linearly with install age.
- PDF report generation (US-138) and headless-render-based exports should run as a background job, not inline with the request, to avoid blocking the single Node event loop this whole app runs on.

---

## Final Product Vision

### What This Product Could Become

Today this is a **Wi-Fi monitoring dashboard**: it watches a well-chosen set of signals on one Mac and shows them well. That's already more honest and more complete than most consumer tools in this space, because it never claims data it can't actually see.

The 142 stories above don't change what the product *watches* — they change what it *does with what it already sees*. The throughline across every category is the same: stop making the user do the correlation in their head. A baseline engine that learns what "normal" means for *this* network. A classifier that turns five charts into "the problem is your gateway, not your Wi-Fi." A diagnostic engine that states its evidence instead of asserting a conclusion. A health score that explains its number instead of just displaying one. An alert pipeline with a lifecycle instead of a flat log. A reporting layer that reaches the user instead of waiting to be opened.

None of this requires becoming something the product isn't. It stays a single-host, no-sudo, locally-honest tool — it just becomes the kind of tool that can tell you *why*, not only *what*, and that you can trust to tell you when it doesn't know. That's the difference between a **Wi-Fi monitoring dashboard** and an **intelligent network observability and security platform**: not more sensors, but a system that reasons, explains, and remembers what it learned about your network — and says so honestly when it's guessing.
