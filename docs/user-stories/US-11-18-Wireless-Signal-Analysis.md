# Category 2: Advanced Wireless & Signal Analysis (US-11 to US-18)

Detailed implementation specifications for User Stories **US-11** through **US-18**.

---

## US-11: Wi-Fi Roaming & Mesh Node Handover Tracker

### 👤 User Story
*As a user in a mesh Wi-Fi network, I want to track when my Mac roams between mesh access points or switches bands so I can verify mesh seamless handover performance.*

### 🏗️ Technical Architecture
- **Collector:** `server/collectors/wifiStats.js`
- **Data Source:** Parse BSSID (`system_profiler SPAirPortDataType` or `wdutil info`) on macOS.
- **Event Detector:** Track changes in BSSID MAC address. Log `roam` event with `oldBssid`, `newBssid`, `band`, `rssi`.

### 🛠️ Developer Implementation Guide
1. In `wifiStats.js`, extract `bssid` field.
2. Store `lastBssid` in collector module scope.
3. If `bssid` changes between ticks, call `logEvent({ kind: 'wifi-roam', severity: 'info', message: 'Roamed to BSSID ' + bssid })`.
4. Render Roam event badge on Overview and Alerts log.

---

## US-12: BSSID & Beacon Frame Detail Inspector

### 👤 User Story
*As a network engineer, I want to inspect technical beacon attributes (channel width 20/40/80/160 MHz, spatial streams MIMO 2x2/4x4, security specs) of my connection.*

### 🛠️ Developer Implementation Guide
1. Extend `server/collectors/wifiStats.js` to parse PHY modes (`802.11ax`, `802.11be`), Channel Width (`80 MHz`), and MCS Index.
2. Create `client/src/components/BssidInspector.jsx` drawer on Diagnostics section.

---

## US-13: Noise Floor & SNR (Signal-to-Noise Ratio) Graph

### 👤 User Story
*As a user experiencing intermittent interference, I want to view a continuous SNR graph (Signal minus Noise) to isolate electromagnetic noise.*

### 🛠️ Developer Implementation Guide
1. Extract `noise` reading (dBm) from `SPAirPortDataType`.
2. Compute $SNR = RSSI - Noise$.
3. Create `client/src/components/SnrChart.jsx` using Recharts to plot RSSI line vs Noise Floor line.

---

## US-14: Wi-Fi 6 / 6E / 7 Protocol Capability Identifier

### 🛠️ Developer Implementation Guide
1. Map PHY standard strings (`802.11ax` $\rightarrow$ Wi-Fi 6/6E, `802.11be` $\rightarrow$ Wi-Fi 7).
2. Render modern protocol badge in `Header.jsx`.

---

## US-15: Nearby Rogue Access Point & Evil Twin Detector

### 🛠️ Developer Implementation Guide
1. In `server/collectors/channels.js`, parse nearby Wi-Fi network SSIDs and BSSIDs.
2. If a nearby BSSID broadcasts the user's active SSID name but has a different MAC prefix or security standard, trigger a high-severity Security Event (`kind: 'rogue-ap-detected'`).

---

## US-16: Distance Estimator via Path Loss Algorithm

### 🛠️ Developer Implementation Guide
1. Add FSPL distance formula in `client/src/lib/signal.js`:
   $$d = 10^{\frac{27.55 - (20 \log_{10}(f)) + |RSSI|}{20}}$$
2. Display estimated distance (e.g. `~4.5 meters from AP`) on Signal card.

---

## US-17: DFS Radar Channel Hop Detection Log

### 🛠️ Developer Implementation Guide
1. Monitor for sudden channel shifts from 5GHz DFS channels (52–144) to standard channels.
2. Log DFS Radar Event in `server/lib/events.js`.

---

## US-18: Band Steering Efficiency Analyzer

### 🛠️ Developer Implementation Guide
1. Evaluate device band distribution (2.4 GHz count vs 5 GHz count) across active LAN devices.
2. Display band steering efficiency percentage badge in Diagnostics.
