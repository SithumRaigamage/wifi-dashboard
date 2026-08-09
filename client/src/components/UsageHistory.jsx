import { useEffect, useState, useCallback } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, Button } from './ui/primitives.jsx';
import { toMbps, fmtMbps } from '../lib/utils.js';

const RANGES = ['1h', '24h'];

function fmtTick(t, range) {
  const d = new Date(t);
  if (range === '24h') return `${d.getHours().toString().padStart(2, '0')}:00`;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function UsageHistory() {
  const [range, setRange] = useState('1h');
  const [points, setPoints] = useState([]);

  const load = useCallback(async (r) => {
    try {
      const res = await fetch(`/api/history?range=${r}`);
      const json = await res.json();
      setPoints(json.points || []);
    } catch {
      setPoints([]);
    }
  }, []);

  useEffect(() => {
    load(range);
    const id = setInterval(() => load(range), 15000);
    return () => clearInterval(id);
  }, [range, load]);

  // Single series: total throughput (down + up) in Mbps.
  const data = points.map((p) => ({
    t: p.t,
    total: (toMbps(p.rx) ?? 0) + (toMbps(p.tx) ?? 0),
  }));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-[var(--text-secondary)]">Usage history</h2>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant="outline"
              onClick={() => setRange(r)}
              className={
                range === r
                  ? 'border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-primary)]'
                  : ''
              }
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <div className="h-44 w-full">
          {data.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--series-download)" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="var(--series-download)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="t"
                  tickFormatter={(t) => fmtTick(t, range)}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  width={48}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: 'Mbps',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: 'var(--text-muted)', textAnchor: 'middle' },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-2)',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 11,
                    color: 'var(--text-primary)',
                  }}
                  labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                  formatter={(v) => [`${fmtMbps(v)} Mbps`, 'Total']}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--series-download)"
                  strokeWidth={2}
                  fill="url(#usageFill)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
              Collecting data… history fills in as the dashboard runs.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
