import { useEffect, useState } from 'react';
import { Card } from './ui/primitives.jsx';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Bucket average latency into the shared success→warning→danger colors.
function cellColor(ms) {
  if (ms == null) return 'var(--surface-2)';
  if (ms < 40) return 'var(--text-success)';
  if (ms < 100) return 'var(--text-warning)';
  return 'var(--text-danger)';
}

// 24 columns (hour of day) × 7 rows (day of week) of average latency.
export function Heatmap() {
  const [grid, setGrid] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/history/heatmap')
        .then((r) => r.json())
        .then((j) => !cancelled && setGrid(j.grid))
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const hasData = grid?.some((row) => row.some((c) => c != null));

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">
          Latency by hour &amp; day
        </span>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Swatch color="var(--text-success)" label="<40" />
          <Swatch color="var(--text-warning)" label="40–100" />
          <Swatch color="var(--text-danger)" label=">100ms" />
        </div>
      </div>

      {!hasData ? (
        <div className="py-6 text-center text-xs text-[var(--text-muted)]">
          Building the heatmap… cells fill in as hourly data accumulates over days.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour axis */}
            <div className="mb-1 flex pl-8 text-[10px] tabular-nums text-[var(--text-muted)]">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center" style={{ minWidth: 13 }}>
                  {h % 6 === 0 ? h : ''}
                </div>
              ))}
            </div>
            {grid.map((row, dow) => (
              <div key={dow} className="flex items-center">
                <div className="w-8 pr-1 text-right text-[10px] text-[var(--text-muted)]">{DOW[dow]}</div>
                {row.map((ms, h) => (
                  <div
                    key={h}
                    title={ms == null ? `${DOW[dow]} ${h}:00 — no data` : `${DOW[dow]} ${h}:00 — ${ms} ms`}
                    className="m-[1px] flex-1 rounded-[2px]"
                    style={{ minWidth: 11, height: 14, background: cellColor(ms) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Swatch({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}
