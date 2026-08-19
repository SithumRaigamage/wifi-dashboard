import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Badge } from './ui/primitives.jsx';

// Ports considered risky to leave open on a LAN device without a clear reason.
const RISKY_PORTS = new Set([445, 23]); // SMB, telnet

// US-22: an IoT device serving plain HTTP (80/8080) with no HTTPS (443) is a
// reasonable candidate for guest-network isolation — if it's compromised or
// has a weak/default admin panel, it's sitting on the same network as
// everything else rather than fenced off.
function needsGuestIsolation(isIot, ports) {
  if (!isIot || !ports) return false;
  const httpOpen = ports.some((p) => (p.port === 80 || p.port === 8080) && p.open);
  const httpsOpen = ports.some((p) => p.port === 443 && p.open);
  return httpOpen && !httpsOpen;
}

// US-19/22: on-demand port audit panel for one device row. Fetches as soon as
// it's mounted (i.e. as soon as the row expands) and caches nothing — a scan
// reflects the device's state right now, not an earlier visit.
export function PortAudit({ ip, isIot }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    fetch('/api/devices/scan-ports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
      signal: controller.signal,
    })
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) setError(json.error || 'scan failed');
        else setResult(json);
      })
      .catch((err) => err.name !== 'AbortError' && setError('scan failed'))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [ip]);

  return (
    <div
      className="mt-2 rounded-[var(--radius)] bg-[var(--surface-2)] px-3 py-2.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">Port audit — {ip}</div>
      {loading && <div className="text-xs text-[var(--text-muted)]">Scanning…</div>}
      {error && <div className="text-xs text-[var(--text-danger)]">{error}</div>}
      {result && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {result.ports.map((p) => (
              <Badge
                key={p.port}
                variant={p.open ? (RISKY_PORTS.has(p.port) ? 'danger' : 'warning') : 'muted'}
                title={p.open ? `Open in ${p.ms}ms` : 'Closed / filtered'}
              >
                {p.service} {p.port}
                {p.open ? ' open' : ' closed'}
              </Badge>
            ))}
          </div>
          {result.openCount > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <ShieldAlert className="h-3 w-3" strokeWidth={1.75} />
              {result.openCount} open port{result.openCount === 1 ? '' : 's'} — make sure each is intentional.
            </div>
          )}
          {needsGuestIsolation(isIot, result.ports) && (
            <div className="mt-1.5">
              <Badge variant="warning" title="Unencrypted admin/API access on an IoT device — consider a guest/IoT VLAN if your router supports one">
                Recommend Guest Isolation
              </Badge>
            </div>
          )}
        </>
      )}
    </div>
  );
}
