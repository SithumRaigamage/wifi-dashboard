import { calculateHealthScore } from './signal.js';

// Every value interpolated into the HTML template below ultimately traces
// back to network data (SSID, DHCP hostname, vendor string, ...) that a
// device on the LAN controls — a malicious/compromised device could set its
// hostname to an HTML/script payload that would otherwise execute when this
// report is opened in a browser. Escape everything unconditionally rather
// than deciding field-by-field what's "safe" (a decision that's easy to get
// wrong today and easier still to get wrong when a field is added later).
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function generateReportHtml(live = {}) {
  const health = calculateHealthScore(live);
  const now = new Date().toLocaleString();
  const wifi = live.wifi || {};
  const latency = live.latency || {};
  const throughput = live.throughput || {};
  const devices = live.devices?.devices || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WiFi Diagnostic & Health Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; line-height: 1.5; }
    .container { max-width: 800px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; }
    h1 { margin-top: 0; font-size: 24px; color: #f8fafc; display: flex; justify-content: space-between; align-items: center; }
    .subtitle { color: #94a3b8; font-size: 13px; margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .card { background: #0f172a; padding: 16px; border-radius: 12px; border: 1px solid #334155; }
    .card-title { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
    .card-val { font-size: 28px; font-weight: 800; margin-top: 4px; color: #38bdf8; }
    .score-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${health.color}; color: #fff; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th { text-align: left; background: #0f172a; padding: 10px; color: #94a3b8; border-bottom: 1px solid #334155; }
    td { padding: 10px; border-bottom: 1px solid #334155; color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      WiFi Network Health Report
      <span class="score-badge">${escapeHtml(health.label)} (${escapeHtml(health.score)}/100)</span>
    </h1>
    <div class="subtitle">Generated on ${escapeHtml(now)} · Host interface monitoring session</div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Wi-Fi Connection</div>
        <div class="card-val" style="font-size:20px;">${escapeHtml(wifi.ssid || 'Local WiFi')}</div>
        <div style="font-size:12px; color:#94a3b8; margin-top:4px;">
          RSSI: ${escapeHtml(wifi.rssi ?? 'N/A')} dBm | Channel: ${escapeHtml(wifi.channel ?? 'N/A')} | Link: ${escapeHtml(wifi.txRate ?? 'N/A')} Mbps
        </div>
      </div>
      <div class="card">
        <div class="card-title">Latency & Stability</div>
        <div class="card-val">${latency.latencyMs != null ? escapeHtml(Math.round(latency.latencyMs)) + ' ms' : 'N/A'}</div>
        <div style="font-size:12px; color:#94a3b8; margin-top:4px;">
          Jitter: ${escapeHtml(latency.jitterMs ?? 0)} ms | Packet Loss: ${escapeHtml(latency.packetLoss ?? 0)}%
        </div>
      </div>
    </div>

    <h2 style="font-size:16px; margin-top:24px; color:#f8fafc;">Active LAN Devices (${escapeHtml(devices.length)})</h2>
    <table>
      <thead>
        <tr>
          <th>Hostname / Vendor</th>
          <th>IP Address</th>
          <th>MAC Address</th>
          <th>RTT Quality</th>
        </tr>
      </thead>
      <tbody>
        ${devices.map(d => `
          <tr>
            <td>${escapeHtml(d.hostname || d.vendor || 'Device')}</td>
            <td>${escapeHtml(d.ip)}</td>
            <td style="font-family:monospace;">${escapeHtml(d.mac)}</td>
            <td>${d.rttMs != null ? escapeHtml(d.rttMs) + ' ms' : 'Active'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export function downloadDiagnosticReport(live) {
  const html = generateReportHtml(live);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `WiFi-Diagnostic-Report-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
