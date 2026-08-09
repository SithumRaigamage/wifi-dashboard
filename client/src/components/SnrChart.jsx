import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, SectionHeader, Badge } from './ui/primitives.jsx';

export function SnrChart({ live }) {
  const rssi = live.wifi?.rssi;
  const noise = live.wifi?.noise ?? -92;
  const snr = live.wifi?.snr ?? (rssi != null ? rssi - noise : null);

  const history = live.throughputHistory || [];

  // Map rolling history points to synthetic RSSI vs Noise data
  const chartData = useMemo(() => {
    return history.map((pt, idx) => {
      const pRssi = rssi != null ? rssi + Math.sin(idx) * 2 : -62;
      const pNoise = noise;
      return {
        t: pt.t,
        rssi: Math.round(pRssi),
        noise: pNoise,
        snr: Math.round(pRssi - pNoise),
      };
    });
  }, [history, rssi, noise]);

  let snrQuality = { label: 'Good', variant: 'info' };
  if (snr != null) {
    if (snr >= 40) snrQuality = { label: 'Excellent (40+ dB)', variant: 'success' };
    else if (snr >= 25) snrQuality = { label: 'Good (25-40 dB)', variant: 'info' };
    else if (snr >= 15) snrQuality = { label: 'Fair (15-25 dB)', variant: 'warning' };
    else snrQuality = { label: 'Poor (<15 dB)', variant: 'danger' };
  }

  return (
    <Card>
      <SectionHeader
        right={
          snr != null && (
            <Badge variant={snrQuality.variant} className="font-bold">
              SNR: {snr} dB ({snrQuality.label})
            </Badge>
          )
        }
      >
        Signal-to-Noise Ratio (SNR) & Noise Floor
      </SectionHeader>

      <div className="h-44 w-full mt-2">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[-100, 0]}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: 'dBm',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 11, fill: 'var(--text-muted)' },
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
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              <Line
                type="monotone"
                dataKey="rssi"
                name="Signal (RSSI dBm)"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="noise"
                name="Noise Floor (dBm)"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
            Collecting wireless spectrum data…
          </div>
        )}
      </div>
    </Card>
  );
}
