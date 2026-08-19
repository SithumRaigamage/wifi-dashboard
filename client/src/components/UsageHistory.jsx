import { useEffect, useState, useCallback, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { History as HistoryIcon, RotateCcw } from 'lucide-react';
import { Card, Button, Badge } from './ui/primitives.jsx';
import { toMbps, fmtMbps, fmtDateTime } from '../lib/utils.js';

const RANGES = ['1h', '24h'];

function fmtTick(t, range) {
  const d = new Date(t);
  if (range === '24h') return `${d.getHours().toString().padStart(2, '0')}:00`;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function UsageHistory() {
  const [range, setRange] = useState('1h');
  const [points, setPoints] = useState([]);
  const [scrubIndex, setScrubIndex] = useState(null);

  const load = useCallback(async (r) => {
    try {
      const res = await fetch(`/api/history?range=${r}`);
      const json = await res.json();
      setPoints(json.points || []);
    } catch {
      setPoints([]);
    }
  }, []);

  // scrubIndex is a plain index into `points` — if a background refetch
  // replaced `points` while scrubbing, that same index could land on a
  // different bucket entirely (the backend buckets relative to "now", so
  // boundaries shift over time) or go out of bounds. "Time Travel Active" +
  // the explicit "Live" button to return already imply a frozen snapshot, so
  // pause the refetch for as long as a scrub selection is active instead of
  // letting it silently swap the inspected data out from under the user. A
  // ref (not scrubIndex directly in the effect deps) so each tick reads the
  // current value without recreating the interval on every scrub drag event.
  const scrubIndexRef = useRef(scrubIndex);
  useEffect(() => {
    scrubIndexRef.current = scrubIndex;
  }, [scrubIndex]);

  useEffect(() => {
    load(range);
    const id = setInterval(() => {
      if (scrubIndexRef.current === null) load(range);
    }, 15000);
    return () => clearInterval(id);
  }, [range, load]);

  // Single series: total throughput (down + up) in Mbps.
  const data = points.map((p) => ({
    t: p.t,
    total: (toMbps(p.rx) ?? 0) + (toMbps(p.tx) ?? 0),
    raw: p,
  }));

  const activePoint = scrubIndex !== null && points[scrubIndex] ? points[scrubIndex] : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-medium text-[var(--text-secondary)]">Usage history</h2>
          {scrubIndex !== null && (
            <Badge variant="warning" className="text-[10px] uppercase font-bold tracking-wider">
              Time Travel Active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {scrubIndex !== null && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScrubIndex(null)}
              className="text-xs flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Live
            </Button>
          )}
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant="outline"
              onClick={() => {
                setRange(r);
                setScrubIndex(null);
              }}
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

        {/* Time Scrubber Control Bar */}
        {points.length > 1 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1 font-medium">
                <HistoryIcon size={13} /> Time Travel Scrubber
              </span>
              <span>
                {activePoint ? fmtDateTime(activePoint.t) : 'Drag slider to inspect historical snapshot'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={points.length - 1}
              value={scrubIndex ?? points.length - 1}
              onChange={(e) => setScrubIndex(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />

            {/* Historical Point Details Drawer */}
            {activePoint && (
              <div className="mt-1 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-strong)] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Download</span>
                  <span className="font-bold text-[var(--series-download)]">{fmtMbps(toMbps(activePoint.rx))} Mbps</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Upload</span>
                  <span className="font-bold text-[var(--series-upload)]">{fmtMbps(toMbps(activePoint.tx))} Mbps</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Signal RSSI</span>
                  <span className="font-bold text-[var(--text-primary)]">{activePoint.rssi != null ? `${activePoint.rssi} dBm` : '—'}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Latency / Loss</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {activePoint.latency != null ? `${Math.round(activePoint.latency)}ms` : '—'} · {activePoint.loss ?? 0}% loss
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

