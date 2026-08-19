# Category 3: Security, Intrusion Prevention & Control (US-19 to US-28)

Detailed implementation specifications for User Stories **US-19** through **US-28**.

---

## US-19: Built-in Port Scanner & Open Port Auditor

### 👤 User Story
*As a network security admin, I want to scan local LAN devices for open ports (22 SSH, 80 HTTP, 443 HTTPS, 445 SMB, 8080) so I can identify insecure devices.*

### 🛠️ Developer Implementation Guide
1. Create `server/collectors/portScanner.js` using Node.js `net.Socket`.
2. Expose endpoint `/api/devices/scan-ports?ip=...`.
3. Render Port Audit drawer in `client/src/sections/Devices.jsx`.

---

## US-20: ARP Spoofing & Duplicate IP Alerting

### 🛠️ Developer Implementation Guide
1. In `server/collectors/lanDevices.js`, detect if two different MAC addresses map to the same IP address or if a single MAC maps to multiple IPs.
2. Trigger high-severity security alert (`kind: 'arp-spoof-warning'`).

---

## US-21: Device OS & Vendor Fingerprinting Engine

### 🛠️ Developer Implementation Guide
1. Expand `server/lib/vendorLookup.js` with OUI MAC prefix table and mDNS/DHCP hostname regex rules to classify OS (iOS, Android, macOS, Windows, Linux, Tizen).

---

## US-22: Unencrypted IoT Device Isolation Warning

### 🛠️ Developer Implementation Guide
1. Identify IoT devices by MAC vendor / hostname.
2. Check if HTTP ports (80/8080) are open without HTTPS.
3. Show "Recommend Guest Isolation" badge on IoT devices.

---

## US-23: Device Bandwidth Hog Alerting & Rate Tracking

### 🛠️ Developer Implementation Guide
1. Measure aggregate delta throughput during active device scans.
2. Alert if an individual device exceeds 50 Mbps for over 15 minutes.

---

## US-24: Guest Network vs Main Network Segmentation

### 🛠️ Developer Implementation Guide
1. Add subnet grouping logic in `lanDevices.js` (e.g. `192.168.1.x` vs `192.168.2.x`).
2. Add network tab filter in `Devices.jsx`.

---

## US-25: Router Admin Portal Security Scanner

### 🛠️ Developer Implementation Guide
1. Send lightweight `HEAD` request to Gateway IP (`192.168.1.1` / `10.0.0.1`) on ports 80/443.
2. Check for unencrypted HTTP admin access and display security recommendation.

---

## US-26: UPnP Port Mapping Audit & Exposure Manager

### 🛠️ Developer Implementation Guide
1. Create `server/collectors/upnp.js` using SSDP (Simple Service Discovery Protocol).
2. Query WANIPConnection UPnP service for active port forwarding mappings.

---

## US-27: SSL/TLS Certificate Expiration Monitor

### 🛠️ Developer Implementation Guide
1. Create `server/collectors/certChecker.js` using `tls.connect`.
2. Inspect `validTo` date of router / NAS HTTPS certificates and alert if $< 14$ days remaining.

---

## US-28: Encrypted DNS vs Local DNS Hijack Validator

### 🛠️ Developer Implementation Guide
1. In `server/collectors/dns.js`, compare DNS query responses from local router DNS vs direct Cloudflare DoH (`1.1.1.1`).
2. Alert if local DNS returns hijacked / redirected IPs.
