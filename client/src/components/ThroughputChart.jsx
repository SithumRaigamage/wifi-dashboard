import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card } from './ui/primitives.jsx';
import { toMbps, fmtMbps } from '../lib/utils.js';

// Square-swatch legend (not recharts' default).
function Legend({ items }) {
  return (
    <div className="flex items-center gap-4">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: it.color }} />
          <span className="text-xs text-[var(--text-secondary)]">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function fmtClock(t) {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d
    .getSeconds()
    .toString()
    .padStart(2, '0')}`;
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const dl = payload.find((p) => p.dataKey === 'down')?.value;
  const ul = payload.find((p) => p.dataKey === 'up')?.value;
  return (
    <div className="rounded-[var(--radius)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs shadow-sm">
      <div style={{ color: 'var(--series-download)' }}>Download {fmtMbps(dl)} Mbps</div>
      <div style={{ color: 'var(--series-upload)' }}>Upload {fmtMbps(ul)} Mbps</div>
    </div>
  );
}

export function ThroughputChart({ history }) {
  // Map rolling buffer (bytes/sec) → Mbps for the chart.
  const data = (history || []).map((h) => ({
    t: h.t,
    down: toMbps(h.rx) ?? 0,
    up: toMbps(h.tx) ?? 0,
  }));

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">Throughput</span>
        <Legend
          items={[
            { label: 'Download', color: 'var(--series-download)' },
            { label: 'Upload', color: 'var(--series-upload)' },
          ]}
        />
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={fmtClock}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
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
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-strong)' }} />
            <Line
              type="monotone"
              dataKey="down"
              stroke="var(--series-download)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="up"
              stroke="var(--series-upload)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
