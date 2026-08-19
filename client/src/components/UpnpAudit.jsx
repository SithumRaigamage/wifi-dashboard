import { useState, useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, SectionHeader, Button, Badge } from './ui/primitives.jsx';

// US-26: on-demand UPnP discovery + active port-forwarding audit. Discovery
// takes a few seconds by design (waiting for SSDP replies), so this is a
// manual "Scan" action, not something polled automatically.
export function UpnpAudit() {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const run = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/diagnostics/upnp', { method: 'POST', signal: controller.signal });
      const json = await res.json();
      if (!res.ok) setError(json.error || 'scan failed');
      else setResult(json);
    } catch (err) {
      if (err.name !== 'AbortError') setError('scan failed');
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  };

  return (
    <Card>
      <SectionHeader
        right={
          <Button size="sm" variant="outline" onClick={run} disabled={running}>
            {running ? 'Scanning… (~3s)' : 'Scan UPnP'}
          </Button>
        }
      >
        UPnP Port Mapping Audit
      </SectionHeader>

      {error && <p className="mt-2 text-xs text-[var(--text-danger)]">{error}</p>}

      {!result && !error && !running && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Discovers your router over UPnP and lists any active port-forwarding rules it has open to the internet.
        </p>
      )}

      {result && !result.upnpAvailable && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          No UPnP-capable router found on this network (it may have UPnP disabled, which is generally a good thing).
        </p>
      )}

      {result?.upnpAvailable && result.error && (
        <p className="mt-2 text-xs text-[var(--text-danger)]">{result.error}</p>
      )}

      {result?.upnpAvailable && !result.error && (
        <div className="mt-3 flex flex-col gap-2">
          {result.mappings.length === 0 ? (
            result.truncated ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                The scan didn't finish in time to confirm whether any ports are forwarded — try scanning again.
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">UPnP is available, but no port mappings are currently open.</p>
            )
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>
                  {result.mappings.length}
                  {result.truncated ? '+' : ''} port{result.mappings.length === 1 && !result.truncated ? '' : 's'} forwarded
                  from the internet to a device on your LAN — review each one below and remove any you don't recognize.
                  {result.truncated && ' The router had more mappings than this scan had time to list — re-run the scan or check your router\'s admin page directly for the full list.'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-medium">
                      <th className="py-2 px-2">External</th>
                      <th className="py-2 px-2">Protocol</th>
                      <th className="py-2 px-2">Internal</th>
                      <th className="py-2 px-2">Description</th>
                      <th className="py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {result.mappings.map((m, i) => (
                      <tr key={`${m.externalPort}-${m.protocol}-${i}`}>
                        <td className="py-2 px-2 font-mono">{m.externalPort}</td>
                        <td className="py-2 px-2">{m.protocol || '—'}</td>
                        <td className="py-2 px-2 font-mono">
                          {m.internalClient}
                          {m.internalPort ? `:${m.internalPort}` : ''}
                        </td>
                        <td className="py-2 px-2">{m.description || '—'}</td>
                        <td className="py-2 px-2">
                          <Badge variant={m.enabled ? 'warning' : 'muted'}>{m.enabled ? 'Open' : 'Disabled'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
