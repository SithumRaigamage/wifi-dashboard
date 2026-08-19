# Category 6: Smart Alerts, Automation & Integrations (US-45 to US-52)

Detailed specifications for User Stories **US-45** through **US-52**.

---

## US-45: Telegram / WhatsApp Alert Bot Integration

### 🛠️ Developer Implementation Guide
1. Create `server/lib/telegramBot.js` using Telegram Bot API (`https://api.telegram.org/bot<token>/sendMessage`).
2. Add Telegram Bot Token and Chat ID settings in `Settings.jsx`.
3. Dispatch warning/danger events to Telegram chat.

---

## US-46: Home Assistant Integration & MQTT Publisher

### 🛠️ Developer Implementation Guide
1. Create `server/lib/mqtt.js` using `mqtt` npm package.
2. Publish Home Assistant MQTT Discovery payloads: `homeassistant/sensor/wifi_health/config` and state updates `wifi_dashboard/state`.

---

## US-47: Apple Watch & iOS Home Screen Widget API

### 🛠️ Developer Implementation Guide
1. Create compact endpoint `/api/widget` returning lightweight JSON: `{ score: 94, rssi: -52, latency: 12, loss: 0, status: "Excellent" }`.

---

## US-48: Custom Webhook Payload Template Editor

### 🛠️ Developer Implementation Guide
1. Add JSON template editor in `Settings.jsx` allowing mustache string interpolation (e.g. `{"text": "Alert: {{message}} at {{ts}}"}`).

---

## US-49: Scheduled Maintenance Alert Mute Window

### 🛠️ Developer Implementation Guide
1. Add mute schedule setting: `{ startHour: 2, endHour: 4, enabled: true }`.
2. Suppress event notifications during mute window.

---

## US-50: Audio Siren Mode for Night Time Intruders

### 🛠️ Developer Implementation Guide
1. Synthesize alarm wave using Web Audio API in `client/src/lib/audioNotifier.js`.
2. Play sound when an unrecognized MAC connects between 11 PM and 6 AM.

---

## US-51: Automated Weekly/Monthly Email Digest

### 🛠️ Developer Implementation Guide
1. Create `server/lib/emailDigest.js` using Node Cron.
2. Generate HTML email summary with 7-day uptime percentage, highest latency spike, total traffic volume, and email via Nodemailer.

---

## US-52: CLI Terminal Client Companion (`wifi-cli`)

### 🛠️ Developer Implementation Guide
1. Create `server/cli.js` with `#!/usr/bin/env node` executable header.
2. Support terminal commands: `wifi status`, `wifi devices`, `wifi speedtest`, `wifi ping`.
3. Output colorized terminal table using `chalk` and `cli-table3`.
