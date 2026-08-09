import { useState } from 'react';
import { Card, SectionHeader, Button, Input, Badge } from './ui/primitives.jsx';
import { latencyVariant } from '../lib/signal.js';

// On-demand traceroute: target input + Run, then a hop list with per-hop latency.
export function Traceroute() {
  const [target, setTarget] = useState('1.1.1.1');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    const t = target.trim();
    if (!t) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/diagnostics/traceroute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: t }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || 'traceroute failed');
      else setResult(json);
    } catch {
      setError('traceroute failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <SectionHeader>Traceroute</SectionHeader>
      <div className="flex gap-2">
        <Input
          value={target}
          placeholder="host or IP"
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run'}
        </Button>
      </div>

      {error && <p className="mt-3 text-xs text-[var(--text-danger)]">{error}</p>}

      {result && (
        <div className="mt-3 flex flex-col">
          {result.hops.map((h) => (
            <div
              key={h.hop}
              className="flex items-center justify-between gap-3 py-1.5"
              style={{ borderBottom: '0.5px solid var(--border)' }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-5 text-right text-xs tabular-nums text-[var(--text-muted)]">{h.hop}</span>
                <span className="truncate text-sm text-[var(--text-primary)]">
                  {h.timeout ? <span className="text-[var(--text-muted)]">* * * (no reply)</span> : h.host}
                </span>
                {h.ip && h.ip !== h.host && (
                  <span className="truncate text-xs tabular-nums text-[var(--text-muted)]">{h.ip}</span>
                )}
              </div>
              {!h.timeout && h.ms != null && (
                <Badge variant={latencyVariant(h.ms)}>{h.ms.toFixed(1)} ms</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
