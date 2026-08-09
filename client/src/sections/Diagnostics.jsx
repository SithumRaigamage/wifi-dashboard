import { Card } from '../components/ui/primitives.jsx';
import { ChannelChart } from '../components/ChannelChart.jsx';
import { Traceroute } from '../components/Traceroute.jsx';
import { latencyVariant } from '../lib/signal.js';

// Small stat card: label → big value → sublabel, colored by quality.
function StatCard({ label, value, unit, sublabel, ms }) {
  return (
    <Card>
      <div className="text-[13px] text-[var(--text-muted)]">{label}</div>
      <div
        className="mt-1 text-2xl font-medium tabular-nums leading-none"
        style={ms != null ? { color: `var(--text-${latencyVariant(ms) === 'muted' ? 'primary' : latencyVariant(ms)})` } : undefined}
      >
        {value}
        {unit && <span className="ml-1 text-base text-[var(--text-muted)]">{unit}</span>}
      </div>
      <div className="mt-1.5 text-xs text-[var(--text-muted)]">{sublabel ?? ' '}</div>
    </Card>
  );
}

export function Diagnostics({ live }) {
  const { dns, latency } = live;
  const rawPing = latency?.latencyMs;
  const dnsMs = dns?.avgMs;

  return (
    <div className="flex flex-col gap-4">
      {/* DNS vs raw ping */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Raw ping"
          value={rawPing != null ? rawPing.toFixed(0) : '—'}
          unit={rawPing != null ? 'ms' : ''}
          sublabel={latency?.host ? `to ${latency.host}` : 'link round-trip'}
          ms={rawPing}
        />
        <StatCard
          label="DNS lookup"
          value={dnsMs != null ? dnsMs.toFixed(0) : '—'}
          unit={dnsMs != null ? 'ms' : ''}
          sublabel={dns ? `${dns.resolved}/${dns.total} resolved` : 'resolver time'}
          ms={dnsMs}
        />
      </div>

      <ChannelChart />
      <Traceroute />
    </div>
  );
}
