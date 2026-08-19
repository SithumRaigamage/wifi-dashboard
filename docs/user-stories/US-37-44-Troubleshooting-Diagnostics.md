# Category 5: Troubleshooting & Diagnostics (US-37 to US-44)

Detailed specifications for User Stories **US-37** through **US-44**.

---

## US-37: One-Click Automated Network Repair Wizard

### 🛠️ Developer Implementation Guide
1. Create `/api/diagnostics/repair` endpoint.
2. Execute macOS helper scripts: `dscacheutil -flushcache; killall -HUP mDNSResponder` (flush DNS cache) and renew DHCP lease via `ipconfig set en0 DHCP`.
3. Display action step progress modal in `Diagnostics.jsx`.

---

## US-38: Continuous Multi-Host Ping Latency Matrix

### 🛠️ Developer Implementation Guide
1. In `server/collectors/latency.js`, ping array of targets: Gateway, ISP Hop, Cloudflare, Google, AWS.
2. Display multi-host latency sparkline card grid in `Diagnostics.jsx`.

---

## US-39: Real-Time MTR (My TraceRoute) Diagnostic Tool

### 🛠️ Developer Implementation Guide
1. Create `server/collectors/mtr.js` running continuous traceroute hops.
2. Render interactive hop list with per-hop packet loss % and latency columns.

---

## US-40: Custom Internal HTTP/HTTPS Service Uptime Monitor

### 🛠️ Developer Implementation Guide
1. Create `server/collectors/httpMonitor.js`.
2. Allow users to add internal HTTP targets (e.g. `http://192.168.1.5:8123` Home Assistant, `http://192.168.1.10:32400` Plex).
3. Display status pills (`200 OK`, `500 Error`, `Timeout`).

---

## US-41: Wake-on-LAN (WoL) Magic Packet Sender

### 🛠️ Developer Implementation Guide
1. Create `server/lib/wol.js` using `dgram` UDP socket.
2. Construct Magic Packet (`0xFF * 6 + MAC * 16`) and broadcast to port 9 (`255.255.255.255`).
3. Add "Wake Device" button on device cards in `Devices.jsx`.

---

## US-42: MTU Size & Packet Fragmentation Tester

### 🛠️ Developer Implementation Guide
1. Run binary ping tests with `ping -D -s <bytes> <host>` to discover maximum non-fragmented payload size (typically 1472 bytes + 28 ICMP/IP header = 1500 MTU).

---

## US-43: DHCP Lease Expiration & Renewal Tracker

### 🛠️ Developer Implementation Guide
1. Parse macOS DHCP lease file `/var/db/dhcpclient/leases/en0.plist`.
2. Display lease expiration countdown timer in Diagnostics.

---

## US-44: Subnet IP Scanner & Available IP Allocator

### 🛠️ Developer Implementation Guide
1. Scan IP range `192.168.1.1` to `192.168.1.254`.
2. List free unassigned IP addresses for manual static IP assignments.
