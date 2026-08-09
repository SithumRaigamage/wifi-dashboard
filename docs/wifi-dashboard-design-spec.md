# WiFi Dashboard — Design Spec

Companion to `wifi-dashboard-plan.md`. This file describes the exact visual design to implement in React + Tailwind + shadcn/ui, matching the approved mockup. Give both files to Claude Code together.

---

## Design tokens

Add these as CSS variables in `index.css` (or extend `tailwind.config` theme colors). Values below work for both light and dark mode — flip the dark block under a `.dark` class or `prefers-color-scheme`.

```css
:root {
  --surface-0: #fcfcfb;      /* page background */
  --surface-1: #f5f4f1;      /* card background */
  --surface-2: #ffffff;      /* raised/inner surface */
  --border: rgba(11, 11, 11, 0.10);
  --border-strong: rgba(11, 11, 11, 0.18);
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #898781;

  --bg-success: #e6f4ea;
  --text-success: #1a7d3a;
  --bg-warning: #fdf1d8;
  --text-warning: #a3690a;
  --bg-danger: #fbe7e6;
  --text-danger: #b3261e;

  --series-download: #2a78d6;  /* blue */
  --series-upload: #1baf7a;    /* aqua/teal */
  --series-latency: #4a3aa7;   /* violet */

  --radius: 8px;
  --radius-card: 12px;
}

.dark {
  --surface-0: #1a1a19;
  --surface-1: #242423;
  --surface-2: #2c2c2a;
  --border: rgba(255, 255, 255, 0.10);
  --border-strong: rgba(255, 255, 255, 0.18);
  --text-primary: #ffffff;
  --text-secondary: #c3c2b7;
  --text-muted: #898781;

  --bg-success: #113a20;
  --text-success: #5fd68a;
  --bg-warning: #402c06;
  --text-warning: #f0b73f;
  --bg-danger: #3d1614;
  --text-danger: #f2837f;

  --series-download: #3987e5;
  --series-upload: #199e70;
  --series-latency: #9085e9;
}
```

**Typography:** system sans stack (Inter or the OS default) throughout. Two weights only — 400 regular, 500 medium. No bold (700) anywhere; it reads heavier than the rest of the UI.

- Page title / SSID name: 16px / 500
- Card labels ("Signal", "Download", etc.): 13px / 400, `--text-muted`
- Card values: 24px / 500, `--text-primary`
- Card sublabels: 12px / 400, `--text-muted`
- Section headers ("Usage history", "Connected devices"): 13px / 500, `--text-secondary`
- Device names: 14px / 400
- Badges/pills: 12px / 400

**Shape & spacing:**
- Cards: `--radius-card` (12px), `padding: 1rem`, background `--surface-1`, **no border, no shadow**
- Buttons/pills/badges: `--radius` (8px) for buttons, `999px` (full pill) for status badges
- Row dividers (device list): `0.5px solid var(--border)`, no card wrapper around the whole list — just a flat stack of rows
- Grid gaps: 12px between cards
- No drop shadows, no gradients anywhere. Flat fills only.

---

## Overall app structure — side navigation + sections

Rather than one long scrolling page, structure the app as a persistent left sidebar plus a routed content area (use `react-router-dom` or simple state-based view switching — a full router is nice-to-have, not required for a single-machine dashboard).

**Sidebar** (~168px wide, fixed):
- Logo row: WiFi icon + SSID name
- Nav items, each an icon (Tabler-style or `lucide-react` equivalent) + label: **Overview**, **Devices**, **History**, **Diagnostics**, **Alerts**, **Settings**
- Active item gets `--surface-2` background, others transparent
- Alerts item shows a small count badge (`--bg-danger`/`--text-danger` pill) when there are unread events
- No border/shadow on the sidebar itself — separate it from content with a single `0.5px solid var(--border)` right-edge line
- Collapses to icon-only under ~768px width (tooltip on hover for labels)

**Content area** — one section visible at a time, switched by sidebar click:

| Section | Contents |
|---|---|
| **Overview** | Header status pill + metric cards + live throughput chart + a short "recent devices" preview (3-4 rows) linking to the full Devices section — this is the original MVP dashboard |
| **Devices** | Full device list: inline-editable name field per row (persists to local storage keyed by MAC), tag pill (Work/Personal/IoT/Guest — simple dropdown or cycling pill), first-seen/last-active timestamps |
| **History** | 1h/24h throughput toggle chart (as before) **plus** a day-of-week × hour-of-day heatmap below it (24 columns × 7 rows, cell color mapped success→warning→danger by average latency that hour) |
| **Diagnostics** | Channel congestion bar chart (channels 1–11, bar height = number of nearby networks detected on that channel), DNS lookup time vs raw ping as two small stat cards, and a traceroute panel (target input + "Run" button + hop list result) |
| **Alerts** | Threshold inputs (signal floor, latency ceiling) at the top, chronological event log below (icon + description + relative timestamp, color-coded by severity) |
| **Settings** | Polling interval select, ping target host input, data retention select, plus two toggle rows for "public read-only status page" and "push alerts to Slack/Discord" |

Each section is its own component; only one mounts/renders at a time to keep the live-updating Overview charts from running when not visible (pause the polling/interval when a different section is active, resume on return).

## Layout structure — Overview section (top to bottom)

1. **Header row** — flex, space-between
   - Left: WiFi icon + SSID name (16px/500) + subtitle "5 GHz · channel 44" (13px, muted)
   - Right: pill badge, `bg-success`/`text-success`, small pulsing dot + "Connected · 3h 42m"

2. **Metric card grid** — `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`, gap 12px
   - 4 cards: Signal (dBm + quality label), Download (Mbps + link rate), Upload (Mbps + link rate), Latency (ms + packet loss %)
   - Each card: label → big value → small sublabel, in `--surface-1`

3. **Throughput chart** — line chart, two series (download/upload) sharing one y-axis (Mbps), last 60 seconds, updating live. Small square-swatch legend above the chart (not the chart library's default legend).

4. **Secondary row** — two cards side by side (stack on mobile):
   - Latency trend: small sparkline (no axes), last 60s
   - Speed test: three inline stats (down/up/ping) + a "Run speed test" button that shows a loading state, then updates values

5. **Usage history** — section header with a 1h/24h toggle (two small buttons, active one gets `--surface-2` background + `--border-strong` outline), single-series area chart below

6. **Connected devices** — flat list (not a bordered table), each row: device icon + name + IP on the left, a signal-quality pill (Strong/Fair/Weak, colored success/warning/danger) on the right. Rows separated by hairline dividers, last row has none.

---

## Component mapping (shadcn/ui)

| Section | shadcn components |
|---|---|
| Metric cards | `Card`, `CardContent` (no header/footer — just padding) |
| Status badge, quality pills | `Badge` with custom `bg-*`/`text-*` classes per the tokens above (success/warning/danger variants) |
| Speed test button | `Button` (default variant), `disabled` + text swap while "running" |
| History range toggle | Two `Button` (`variant="outline"`, `size="sm"`), active state toggled via conditional className |
| Device list rows | Plain flex divs, not `Table` — a table felt too heavy for 4–6 rows in the reference design |
| Charts | `recharts` `LineChart`/`AreaChart`, not shadcn — style per the color tokens above, one y-axis only, no gridlines on x-axis, muted gray gridlines on y-axis |

## Chart specifics (recharts)

- Line width 2px, no dots (`dot={false}`), `type="monotone"`
- Area fill opacity ~0.1 of the stroke color
- X-axis: `axisLine={false}` `tickLine={false}`, muted text color, max ~6 ticks
- Y-axis: gridlines in a near-surface gray, muted tick labels, single axis label (e.g. "Mbps")
- Never use two y-axes on the same chart
- Live charts: keep a fixed-length rolling array (e.g. last 30 points) in React state, push/shift on each WebSocket tick, don't re-mount the chart

## Interaction notes

- Live values update every ~2s (from WebSocket in the real app)
- The "Connected" badge's dot should have a subtle pulse (opacity animation, ~2s cycle) to signal "live," not a spinner
- Speed test button: disable + label change to "Testing…" while in flight, restore on completion
- History toggle: only one of 1h/24h active at a time, instant chart swap (no page reload)
- Signal quality thresholds: ≥ -55 dBm = Strong/success, -55 to -67 = Fair/warning, < -67 = Weak/danger — reuse this same threshold logic for the device list and the header signal card
