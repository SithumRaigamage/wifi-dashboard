# WiFi Monitoring Dashboard — Master User Stories & Feature Roadmap (US-01 to US-52)

This directory contains comprehensive, developer-ready User Story task specifications for **52 high-impact features** across 6 core domains.

Each story details:
- User Needs & Problem Statement
- Visual & UI/UX Design Specifications
- Technical Data Flow & Backend APIs
- Developer Step-by-Step Implementation Guide
- Acceptance Criteria & Verification

---

> **Extended backlog:** [US-53-194-Future-Product-Backlog.md](./US-53-194-Future-Product-Backlog.md) adds
> 142 further stories (US-053–US-194) — advanced analytics, an explainable root-cause diagnostics engine,
> security/incident/alert intelligence, baselines, reporting, and integrations — evolving beyond US-01–52
> without duplicating any of them. Includes priority/feasibility matrices, a phased Phase 3–8 roadmap, and
> a Kill/Keep/Invest analysis.

## 📚 User Story Index

### Category 1: UI/UX & Visual Experience (`US-01-10-UI-UX-Experience.md`)
| Story ID | Title | Priority | Complexity | Target Component |
|---|---|---|---|---|
| **US-01** | Interactive 3D / 2D House Floor Plan Signal Heatmap | High | High | `client/src/sections/FloorPlan.jsx` |
| **US-02** | Kiosk / Wall-Mount Full-Screen Display Mode | Medium | Low | `client/src/sections/Kiosk.jsx` |
| **US-03** | Custom Drag-and-Drop Card Layout Builder | Low | Medium | `client/src/sections/Overview.jsx` |
| **US-04** | Floating Picture-in-Picture Mini HUD Widget | Low | Medium | `client/src/components/PipWidget.jsx` |
| **US-05** | Interactive Time Travel History Scrubbing Slider | Medium | Medium | `client/src/components/UsageHistory.jsx` |
| **US-06** | Custom Color Accent & OLED Pitch Black Themes | Low | Low | `client/src/App.jsx` & `index.css` |
| **US-07** | Customizable Audio Cues & Event Sound Effects | Low | Low | `client/src/lib/audioNotifier.js` |
| **US-08** | Compact Spreadsheet Table View for Devices | Medium | Low | `client/src/sections/Devices.jsx` |
| **US-09** | Multi-Language (i18n) Internationalization | Low | Medium | `client/src/lib/i18n.js` |
| **US-10** | Customizable Dashboard Refresh Rate Control | Medium | Low | `client/src/sections/Settings.jsx` |

---

### Category 2: Advanced Wireless & Signal Analysis (`US-11-18-Wireless-Signal-Analysis.md`)
| Story ID | Title | Priority | Complexity | Target Component |
|---|---|---|---|---|
| **US-11** | Wi-Fi Roaming & Mesh Node Handover Tracker | High | High | `server/collectors/wifiStats.js` |
| **US-12** | BSSID & Beacon Frame Detail Inspector | Medium | Medium | `client/src/components/BssidInspector.jsx` |
| **US-13** | Noise Floor & SNR (Signal-to-Noise Ratio) Graph | High | Medium | `client/src/components/SnrChart.jsx` |
| **US-14** | Wi-Fi 6 / 6E / 7 Protocol Capability Identifier | Medium | Low | `server/collectors/wifiStats.js` |
| **US-15** | Nearby Rogue Access Point & Evil Twin Detector | High | High | `server/lib/security.js` |
| **US-16** | Distance Estimator via Path Loss Algorithm | Low | Low | `client/src/lib/signal.js` |
| **US-17** | DFS Radar Channel Hop Detection Log | Low | Medium | `server/collectors/channels.js` |
| **US-18** | Band Steering Efficiency Analyzer | Medium | Medium | `client/src/sections/Diagnostics.jsx` |

---

### Category 3: Security, Intrusion Prevention & Control (`US-19-28-Security-Intrusion-Control.md`)
| Story ID | Title | Priority | Complexity | Target Component |
|---|---|---|---|---|
| **US-19** | Built-in Port Scanner & Open Port Auditor | High | High | `server/collectors/portScanner.js` |
| **US-20** | ARP Spoofing & Duplicate IP Alerting | High | High | `server/collectors/lanDevices.js` |
| **US-21** | Device OS & Vendor Fingerprinting Engine | Medium | Medium | `server/lib/fingerprint.js` |
| **US-22** | Unencrypted IoT Device Isolation Warning | High | Medium | `server/lib/security.js` |
| **US-23** | Device Bandwidth Hog Alerting & Rate Tracking | High | Medium | `server/lib/bandwidthTracker.js` |
| **US-24** | Guest Network vs Main Network Segmentation | Medium | Medium | `client/src/sections/Devices.jsx` |
| **US-25** | Router Admin Portal Security Scanner | Medium | Low | `server/collectors/routerScanner.js` |
| **US-26** | UPnP Port Mapping Audit & Exposure Manager | Low | High | `server/collectors/upnp.js` |
| **US-27** | SSL/TLS Certificate Expiration Monitor | Low | Low | `server/collectors/certChecker.js` |
| **US-28** | Encrypted DNS vs Local DNS Hijack Validator | High | Medium | `server/collectors/dns.js` |

---

### Category 4: Analytics, Intelligence & Machine Learning (`US-29-36-Analytics-Intelligence-ML.md`)
| Story ID | Title | Priority | Complexity | Target Component |
|---|---|---|---|---|
| **US-29** | AI Traffic Anomaly & Intruder ML Engine | High | High | `server/lib/anomalyDetector.js` |
| **US-30** | ISP Downtime SLA Outage Logger & Report Generator | High | Medium | `server/lib/slaLogger.js` |
| **US-31** | Peak vs Off-Peak Bandwidth Analytics | Medium | Low | `client/src/sections/History.jsx` |
| **US-32** | Device Lifetime Session & Data Volume Stats | Medium | Medium | `server/lib/devices.js` |
| **US-33** | Router Bufferbloat Tester & Letter Grading | High | High | `server/collectors/bufferbloat.js` |
| **US-34** | Real-Time Multi-Provider DNS Benchmark | Medium | Low | `client/src/sections/Diagnostics.jsx` |
| **US-35** | Internal vs External Latency Correlation Matrix | Medium | Medium | `client/src/components/LatencyMatrix.jsx` |
| **US-36** | Predictive Wi-Fi Quality & Traffic Forecast | Low | High | `server/lib/predictor.js` |

---

### Category 5: Troubleshooting & Diagnostics (`US-37-44-Troubleshooting-Diagnostics.md`)
| Story ID | Title | Priority | Complexity | Target Component |
|---|---|---|---|---|
| **US-37** | One-Click Automated Network Repair Wizard | High | Medium | `client/src/sections/Diagnostics.jsx` |
| **US-38** | Continuous Multi-Host Ping Latency Matrix | High | Medium | `server/collectors/latency.js` |
| **US-39** | Real-Time MTR (My TraceRoute) Diagnostic Tool | Medium | High | `server/collectors/mtr.js` |
| **US-40** | Custom Internal HTTP/HTTPS Service Uptime Monitor | Medium | Low | `server/collectors/httpMonitor.js` |
| **US-41** | Wake-on-LAN (WoL) Magic Packet Sender | Medium | Low | `server/lib/wol.js` |
| **US-42** | MTU Size & Packet Fragmentation Tester | Low | Medium | `server/collectors/mtuFinder.js` |
| **US-43** | DHCP Lease Expiration & Renewal Tracker | Low | Medium | `server/collectors/dhcpTracker.js` |
| **US-44** | Subnet IP Scanner & Available IP Allocator | Low | Low | `client/src/sections/Devices.jsx` |

---

### Category 6: Smart Alerts, Automation & Integrations (`US-45-52-Smart-Alerts-Integrations.md`)
| Story ID | Title | Priority | Complexity | Target Component |
|---|---|---|---|---|
| **US-45** | Telegram / WhatsApp Alert Bot Integration | High | Medium | `server/lib/telegramBot.js` |
| **US-46** | Home Assistant Integration & MQTT Publisher | High | Medium | `server/lib/mqtt.js` |
| **US-47** | Apple Watch & iOS Home Screen Widget API | Medium | Low | `server/lib/api.js` |
| **US-48** | Custom Webhook Payload Template Editor | Medium | Low | `client/src/sections/Settings.jsx` |
| **US-49** | Scheduled Maintenance Alert Mute Window | Low | Low | `server/lib/settings.js` |
| **US-50** | Audio Siren Mode for Night Time Intruders | Low | Low | `client/src/lib/audioNotifier.js` |
| **US-51** | Automated Weekly/Monthly Email Digest | Medium | Medium | `server/lib/emailDigest.js` |
| **US-52** | CLI Terminal Client Companion (`wifi-cli`) | Medium | Medium | `server/cli.js` |

---

## 🛠️ Implementation Guidance for Developers

When implementing any User Story from these files:
1. Open the corresponding `.md` file in `docs/user-stories/`.
2. Follow the **Technical Architecture & Data Flow** schema.
3. Execute the steps in **Step-by-Step Developer Implementation Roadmap**.
4. Verify using the listed **Acceptance Criteria**.
