# Category 4: Analytics, Intelligence & Machine Learning (US-29 to US-36)

Detailed specifications for User Stories **US-29** through **US-36**.

---

## US-29: AI Traffic Anomaly & Intruder ML Engine

### 🛠️ Developer Implementation Guide
1. Create `server/lib/anomalyDetector.js`.
2. Calculate moving mean and standard deviation ($\sigma$) for hourly bandwidth and connected device counts.
3. Flag data points $> 3\sigma$ from normal baseline as statistical anomalies.

---

## US-30: ISP Downtime SLA Outage Logger & Report Generator

### 🛠️ Developer Implementation Guide
1. Create `server/lib/slaLogger.js`.
2. When ping fails continuously for $>60$ seconds, log an Outage Record: `{ startTime, endTime, durationSeconds }`.
3. Generate printable ISP Credit Claim PDF/HTML.

---

## US-31: Peak vs Off-Peak Bandwidth Analytics

### 🛠️ Developer Implementation Guide
1. Aggregate historical snapshot data by Time-of-Day buckets (Business Hours 9am-5pm vs Evening 5pm-12am vs Night 12am-9am).
2. Render comparison chart in `History.jsx`.

---

## US-32: Device Lifetime Session & Data Volume Stats

### 🛠️ Developer Implementation Guide
1. Track cumulative online time (seconds) and estimated data volume (MB) per device MAC in `device_history` SQLite table.

---

## US-33: Router Bufferbloat Tester & Letter Grading

### 🛠️ Developer Implementation Guide
1. Create `server/collectors/bufferbloat.js`.
2. Measure baseline ping latency, then measure ping latency during active download speed test.
3. Grade Bufferbloat: $+0-5$ms = **A+**, $+5-15$ms = **A**, $+15-30$ms = **B**, $+30-60$ms = **C**, $>60$ms = **F**.

---

## US-34: Real-Time Multi-Provider DNS Benchmark

### 🛠️ Developer Implementation Guide
1. Benchmark 5 DNS resolvers simultaneously (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`, `208.67.222.222`, local router).
2. Render latency comparison table in `Diagnostics.jsx`.

---

## US-35: Internal vs External Latency Correlation Matrix

### 🛠️ Developer Implementation Guide
1. Ping local Gateway IP and external target `1.1.1.1` simultaneously.
2. If Gateway ping is low (<2ms) but external ping is high (>80ms), isolate lag to ISP connection.

---

## US-36: Predictive Wi-Fi Quality & Traffic Forecast

### 🛠️ Developer Implementation Guide
1. Run linear regression over hourly rollups to forecast expected network congestion over the next 6 hours.
