# Category 1: UI/UX & Visual Experience (US-01 to US-10)

This document provides detailed design, technical architecture, and developer implementation instructions for User Stories **US-01** through **US-10**.

---

## US-01: Interactive 3D / 2D House Floor Plan Signal Heatmap

### 👤 User Story
*As a home or office network administrator, I want to upload an image of my house/office floor plan and place signal markers across rooms so that I can visually identify Wi-Fi dead zones and optimal AP placements.*

### 🎨 Visual & UI/UX Design
- **Location:** `client/src/sections/FloorPlan.jsx` (New tab or section in Sidebar).
- **Interface:** Canvas/SVG overlay on top of an uploaded floor plan image (`PNG/JPEG`).
- **Controls:** "Upload Floor Plan" button, "Add Measurement Spot" pin dropper tool, RSSI color gradient slider (-30 dBm green to -90 dBm red), and Heatmap opacity slider.

### 🏗️ Technical Architecture & Data Flow
- **Client State:** Canvas rendering using HTML5 `<canvas>` or Fabric.js/Konva library.
- **Persistence:** LocalStorage key `wifi-dashboard.floorplan` storing base64 image reference and array of sample points: `{ x: number, y: number, rssi: number, room: string }`.
- **Interpolation Algorithm:** Inverse Distance Weighting (IDW) to generate smooth color heat gradients across the floor plan.

### 🛠️ Developer Implementation Guide
1. Create `client/src/sections/FloorPlan.jsx` with an HTML5 `<canvas>` wrapper.
2. Implement file dropzone to read image via `FileReader.readAsDataURL()`.
3. Implement canvas click listener to drop pins capturing current `live.wifi.rssi` reading.
4. Render IDW interpolation shader/canvas context loop mapping RSSI values to HSL colors (`hsl(120, 100%, 50%)` to `hsl(0, 100%, 50%)`).
5. Add navigation item in `Sidebar.jsx` and section route in `App.jsx`.

### ✅ Acceptance Criteria
- [ ] User can upload floor plan image.
- [ ] User can click anywhere on the floor plan to record current Wi-Fi RSSI.
- [ ] Heatmap smoothly interpolates colors between measurement pins.
- [ ] Floor plan and pin data persist across page reloads.

---

## US-02: Kiosk / Wall-Mount Full-Screen Display Mode

### 👤 User Story
*As a user with a dedicated tablet/monitor on the wall, I want an uncluttered, high-contrast, auto-scaling Kiosk view so that I can see network status from across the room.*

### 🎨 Visual & UI/UX Design
- **Location:** `client/src/sections/Kiosk.jsx` (Accessible via top-right "Fullscreen Kiosk" button).
- **Design:** Dark glassmorphic background with high-legibility typography, huge 120px Health Score gauge, large throughput numbers, and pulsing LED status ring.

### 🏗️ Technical Architecture
- **Browser API:** `document.documentElement.requestFullscreen()`.
- **Responsive Layout:** CSS container queries & flexbox scaling to fit 1080p, 4K, or 7-inch tablet screens.

### 🛠️ Developer Implementation Guide
1. Create `client/src/sections/Kiosk.jsx`.
2. Add "Kiosk Mode" toggle in `Sidebar.jsx` or `Header.jsx`.
3. Auto-hide cursor after 3 seconds of inactivity (`cursor: none` class).
4. Render high-contrast gauge, throughput, latency, and alert status pills.

### ✅ Acceptance Criteria
- [ ] Fullscreen API activates on button click.
- [ ] Typography and gauges scale dynamically to fill the screen without scrollbars.
- [ ] Inactivity auto-hides mouse cursor.

---

## US-03: Custom Drag-and-Drop Card Layout Builder

### 👤 User Story
*As a power user, I want to reorder, resize, and toggle widgets on the Overview dashboard so that the metrics I care about most are displayed first.*

### 🛠️ Developer Implementation Guide
1. Integrate `@hello-pangea/dnd` or `gridstack`.
2. Wrap `Overview.jsx` cards in draggable containers.
3. Save grid position matrix in `localStorage` under `wifi-dashboard.layout`.

---

## US-04: Floating Picture-in-Picture Mini HUD Widget

### 👤 User Story
*As a gamer/developer, I want a mini floating HUD window on top of other desktop applications showing live ping and bandwidth.*

### 🛠️ Developer Implementation Guide
1. Use `window.documentPictureInPicture.requestWindow({ width: 300, height: 150 })`.
2. Render lightweight SVG ping sparkline and bandwidth counter inside the PIP window context.

---

## US-05: Interactive Time Travel History Scrubbing Slider

### 👤 User Story
*As a user investigating past lag, I want to drag a timeline slider across past hours to see what the entire dashboard looked like at that moment.*

### 🛠️ Developer Implementation Guide
1. Add range scrubber below charts in `UsageHistory.jsx`.
2. Query `SELECT * FROM snapshots WHERE ts = ?` from SQLite/MySQL backend via `/api/history/snapshot?ts=...`.
3. Temporarily override `live` state bindings in dashboard with historical snapshot values.

---

## US-06: Custom Color Accent & OLED Pitch Black Themes

### 🛠️ Developer Implementation Guide
1. Expand CSS variable tokens in `client/src/index.css`: `--surface-0: #000000`, `--accent-primary: #00ff66`.
2. Add theme selector dropdown in `Settings.jsx` supporting: *System, Light, Dark, OLED Black, Cyberpunk, Emerald*.

---

## US-07: Customizable Audio Cues & Event Sound Effects

### 🛠️ Developer Implementation Guide
1. Create `client/src/lib/audioNotifier.js` using Web Audio API synthesized tones (short high-frequency beep for reconnect, low double-pulse for disconnect/alert).
2. Wire to WebSocket `event` dispatcher in `useLiveData.js`.

---

## US-08: Compact Spreadsheet Table View for Devices

### 🛠️ Developer Implementation Guide
1. Add view mode toggle (Cards vs Table) in `Devices.jsx`.
2. Render sortable HTML `<table>` with column sorting for IP, MAC, Vendor, Ping RTT, and First/Last Seen timestamps.

---

## US-09: Multi-Language (i18n) Internationalization

### 🛠️ Developer Implementation Guide
1. Create dictionary JSONs in `client/src/locales/` (`en.json`, `es.json`, `de.json`, `fr.json`).
2. Implement lightweight `t(key)` translation hook in `client/src/lib/i18n.js`.

---

## US-10: Customizable Dashboard Refresh Rate Control

### 🛠️ Developer Implementation Guide
1. Add interval selector (500ms, 1s, 2s, 5s) in `Settings.jsx`.
2. Send update setting to backend `/api/settings` to adjust collector loop intervals in `server/index.js`.
