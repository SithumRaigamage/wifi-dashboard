import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, SectionHeader, Button, Badge } from './ui/primitives.jsx';

// US-25: on-demand check of the router's own admin portal — HTTP reachable
// with no HTTPS available is a common but risky default on consumer
// routers. No target input: the server resolves its own default gateway,
// this is specifically "scan my router," not a general scan tool.
export function RouterSecurityScan() {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  // Abort an in-flight scan if this component unmounts (navigating away
  // mid-scan) — same reasoning as PortAudit.jsx's AbortController.
  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const run = async () => {
    controllerRef.current?.abort(); // cancel a still-running previous scan
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/diagnostics/router-scan', { method: 'POST', signal: controller.signal });
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
            {running ? 'Scanning…' : 'Scan Router'}
          </Button>
        }
      >
        Router Admin Portal Security
      </SectionHeader>

      {error && <p className="mt-2 text-xs text-[var(--text-danger)]">{error}</p>}

      {!result && !error && !running && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Checks whether your router's admin portal is reachable over unencrypted HTTP with no HTTPS available.
        </p>
      )}

      {result && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>Gateway {result.gatewayIp}:</span>
            <Badge variant={result.httpOpen ? 'warning' : 'muted'}>HTTP {result.httpOpen ? 'open' : 'closed'}</Badge>
            <Badge variant={result.httpsOpen ? 'success' : 'muted'}>HTTPS {result.httpsOpen ? 'open' : 'closed'}</Badge>
          </div>

          {result.recommendation ? (
            <div className="p-3 rounded-xl border text-xs flex items-start gap-2 bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{result.recommendation}</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl border text-xs flex items-start gap-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <span>
                {result.httpsOpen
                  ? 'Admin portal is reachable over HTTPS.'
                  : 'No unencrypted-only admin access detected on the standard ports.'}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
