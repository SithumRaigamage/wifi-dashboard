import { useEffect, useState } from 'react';
import { Card, SectionHeader, Input } from '../components/ui/primitives.jsx';
import { EventLog } from '../components/EventLog.jsx';

// Daily recap + downtime, refreshed periodically.
function SummaryCard() {
  const [summary, setSummary] = useState(null);
  const [downtime, setDowntime] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [s, d] = await Promise.all([
          fetch('/api/history/summary?range=24h').then((r) => r.json()),
          fetch('/api/downtime').then((r) => r.json()),
        ]);
        if (cancelled) return;
        setSummary(s && Object.keys(s).length ? s : null);
        setDowntime(d);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const downMin = downtime ? Math.round(downtime.todayMs / 60000) : 0;

  const stats = [
    { label: 'Avg download', value: summary?.avgDownMbps != null ? `${summary.avgDownMbps}` : '—', unit: 'Mbps' },
    { label: 'Avg latency', value: summary?.avgLatencyMs != null ? `${summary.avgLatencyMs}` : '—', unit: 'ms' },
    {
      label: 'Worst spike',
      value: summary?.worstLatency?.latencyMs != null ? `${summary.worstLatency.latencyMs}` : '—',
      unit: 'ms',
    },
    { label: 'Downtime today', value: `${downMin}`, unit: 'min', danger: downMin > 0 },
  ];

  return (
    <Card>
      <div className="mb-3 text-[13px] font-medium text-[var(--text-secondary)]">Last 24 hours</div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
            <div
              className="mt-1 text-xl font-medium tabular-nums"
              style={s.danger ? { color: 'var(--text-danger)' } : undefined}
            >
              {s.value}
              <span className="ml-1 text-xs text-[var(--text-muted)]">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>
      {summary?.busiestHour?.hour && (
        <div className="mt-3 text-xs text-[var(--text-muted)]">
          Busiest hour:{' '}
          <span className="text-[var(--text-primary)]">
            {new Date(summary.busiestHour.hour).toLocaleTimeString([], { hour: '2-digit' })}
          </span>{' '}
          ({summary.busiestHour.mbps} Mbps avg)
          {downtime?.down && <span className="text-[var(--text-danger)]"> · currently offline</span>}
        </div>
      )}
    </Card>
  );
}

// Threshold inputs — write straight through to shared settings.
function Thresholds({ settings, onSave }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);
  if (!local) return null;

  const field = (key) => ({
    value: local[key] ?? '',
    onChange: (e) => setLocal((p) => ({ ...p, [key]: e.target.value })),
    onBlur: () => {
      const num = Number(local[key]);
      if (!Number.isNaN(num) && num !== settings[key]) onSave({ [key]: num });
    },
  });

  return (
    <Card>
      <div className="mb-3 text-[13px] font-medium text-[var(--text-secondary)]">Alert thresholds</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Signal floor (dBm)
          <Input type="number" {...field('signalFloor')} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Latency ceiling (ms)
          <Input type="number" {...field('latencyCeiling')} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          Packet-loss ceiling (%)
          <Input type="number" {...field('lossCeiling')} />
        </label>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Crossing a threshold logs an event below (and pushes to your webhook if enabled in Settings).
      </p>
    </Card>
  );
}

export function Alerts({ live }) {
  const { events, settings, saveSettings, clearEvents } = live;
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader>Alerts</SectionHeader>
      <SummaryCard />
      <Thresholds settings={settings} onSave={saveSettings} />
      <EventLog events={events} onClear={clearEvents} />
    </div>
  );
}
