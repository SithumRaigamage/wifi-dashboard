import { ResponsiveContainer, AreaChart, Area, YAxis, Tooltip } from 'recharts';
import { Card, Badge } from './ui/primitives.jsx';
import { latencyVariant } from '../lib/signal.js';

export function LatencyTrend({ latency, history }) {
  const ms = latency?.latencyMs;
  const data = (history || []).filter((h) => h.ms != null);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">Latency trend</span>
        <span className="text-xs text-[var(--text-muted)]">{latency?.host ?? ''}</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-medium tabular-nums leading-none">
          {ms != null ? ms.toFixed(0) : '—'}
        </span>
        <span className="text-sm text-[var(--text-muted)]">ms</span>
        <Badge variant={latencyVariant(ms)} className="ml-1">
          {ms == null ? 'No reply' : ms < 40 ? 'Great' : ms < 100 ? 'OK' : 'High'}
        </Badge>
      </div>

      <div className="mt-3 h-16 w-full">
        {data.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="latFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-latency)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--series-latency)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin - 5', 'dataMax + 10']} />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-2)',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'var(--text-primary)',
                }}
                labelFormatter={() => ''}
                formatter={(v) => [`${Number(v).toFixed(0)} ms`, '']}
              />
              <Area
                type="monotone"
                dataKey="ms"
                stroke="var(--series-latency)"
                strokeWidth={2}
                fill="url(#latFill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
