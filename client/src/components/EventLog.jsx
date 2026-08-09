import { WifiOff, Wifi, TriangleAlert, ActivitySquare, UserPlus, Bell } from 'lucide-react';
import { Card, SectionHeader, Button } from './ui/primitives.jsx';
import { fmtRelative, fmtDateTime } from '../lib/utils.js';

const KIND_META = {
  disconnect: { icon: WifiOff, color: 'var(--text-danger)' },
  reconnect: { icon: Wifi, color: 'var(--text-success)' },
  'signal-low': { icon: TriangleAlert, color: 'var(--text-warning)' },
  'latency-high': { icon: ActivitySquare, color: 'var(--text-warning)' },
  'loss-high': { icon: TriangleAlert, color: 'var(--text-danger)' },
  'new-device': { icon: UserPlus, color: 'var(--text-secondary)' },
};

const SEV_COLOR = {
  danger: 'var(--text-danger)',
  warning: 'var(--text-warning)',
  info: 'var(--text-secondary)',
};

export function EventLog({ events, onClear }) {
  return (
    <div>
      <SectionHeader
        right={
          events?.length > 0 && (
            <Button size="sm" variant="outline" onClick={onClear}>
              Clear
            </Button>
          )
        }
      >
        Event log
      </SectionHeader>

      <Card className="px-4 py-0">
        {!events || events.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-muted)]">
            <Bell className="h-4 w-4" /> No events yet. Disconnects, spikes and new devices show up here.
          </div>
        ) : (
          events.map((e, i) => {
            const meta = KIND_META[e.kind] || { icon: Bell, color: SEV_COLOR[e.severity] };
            const Icon = meta.icon;
            return (
              <div
                key={e.id ?? e.ts + i}
                className="flex items-start gap-3 py-3"
                style={i < events.length - 1 ? { borderBottom: '0.5px solid var(--border)' } : undefined}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[var(--text-primary)]">{e.message}</div>
                  <div className="text-xs text-[var(--text-muted)]" title={fmtDateTime(e.ts)}>
                    {fmtRelative(e.ts)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
