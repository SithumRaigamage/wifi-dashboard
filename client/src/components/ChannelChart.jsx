import { useEffect, useState, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { Card, SectionHeader, Button } from './ui/primitives.jsx';

// 2.4 GHz congestion: how many nearby networks sit on each of channels 1–11.
// 5 GHz networks (many non-overlapping channels) are summarised as a line below.
export function ChannelChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagnostics/channels');
      setData(await res.json());
    } catch {
      setData({ error: 'scan failed', channels: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const channels = data?.channels ?? [];
  const own = data?.ownChannel;

  // Fixed 1–11 axis for the 2.4 GHz band.
  const bars = Array.from({ length: 11 }, (_, i) => {
    const ch = i + 1;
    const match = channels.find((c) => c.channel === ch && /2/.test(c.band || ''));
    return { channel: ch, count: match?.count ?? 0 };
  });
  const fiveGhz = channels.filter((c) => /5/.test(c.band || ''));

  return (
    <Card>
      <SectionHeader
        right={
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Rescan
          </Button>
        }
      >
        Channel congestion (2.4 GHz)
      </SectionHeader>

      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="channel"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--border)' }}
              contentStyle={{
                background: 'var(--surface-2)',
                border: 'none',
                borderRadius: 8,
                fontSize: 11,
                color: 'var(--text-primary)',
              }}
              formatter={(v) => [`${v} network${v === 1 ? '' : 's'}`, 'On channel']}
              labelFormatter={(c) => `Channel ${c}`}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {bars.map((b) => (
                <Cell
                  key={b.channel}
                  fill={b.channel === own ? 'var(--series-latency)' : 'var(--series-download)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-xs text-[var(--text-muted)]">
        {own != null ? (
          <span>
            Your network is on channel <span className="text-[var(--text-primary)]">{own}</span>.{' '}
          </span>
        ) : null}
        {fiveGhz.length > 0 && (
          <span>
            5 GHz nearby: {fiveGhz.map((c) => `ch ${c.channel} (${c.count})`).join(', ')}.
          </span>
        )}
        {data?.error && <span className="text-[var(--text-danger)]">Scan unavailable.</span>}
      </div>
    </Card>
  );
}
