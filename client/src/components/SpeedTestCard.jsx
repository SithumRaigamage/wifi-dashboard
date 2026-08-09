import { ArrowDown, ArrowUp, Gauge } from 'lucide-react';
import { Card, Button } from './ui/primitives.jsx';
import { fmtMbps } from '../lib/utils.js';

function Stat({ icon: Icon, label, value, unit, color }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
        <Icon className="h-3 w-3" style={color ? { color } : undefined} />
        {label}
      </div>
      <div className="mt-0.5 text-lg font-medium tabular-nums" style={color ? { color } : undefined}>
        {value}
        <span className="ml-1 text-xs text-[var(--text-muted)]">{unit}</span>
      </div>
    </div>
  );
}

export function SpeedTestCard({ speedtest, running, onRun }) {
  const s = speedtest || {};
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">Speed test</span>
        {s.ts && !running && (
          <span className="text-xs text-[var(--text-muted)]">
            {new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="grid grid-cols-3 gap-4">
          <Stat
            icon={ArrowDown}
            label="Download"
            value={running ? '…' : fmtMbps(s.download)}
            unit="Mbps"
            color="var(--series-download)"
          />
          <Stat
            icon={ArrowUp}
            label="Upload"
            value={running ? '…' : fmtMbps(s.upload)}
            unit="Mbps"
            color="var(--series-upload)"
          />
          <Stat
            icon={Gauge}
            label="Ping"
            value={running ? '…' : s.ping != null ? s.ping.toFixed(0) : '—'}
            unit="ms"
          />
        </div>
        <Button onClick={onRun} disabled={running}>
          {running ? 'Testing…' : 'Run speed test'}
        </Button>
      </div>
    </Card>
  );
}
