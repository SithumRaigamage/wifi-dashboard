import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Badge } from './ui/primitives.jsx';

// Ports considered risky to leave open on a LAN device without a clear reason.
const RISKY_PORTS = new Set([445, 23]); // SMB, telnet

// US-19: on-demand port audit panel for one device row. Fetches as soon as
// it's mounted (i.e. as soon as the row expands) and caches nothing — a scan
// reflects the device's state right now, not an earlier visit.
export function PortAudit({ ip }) {
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
        </>
      )}
    </div>
  );
}
