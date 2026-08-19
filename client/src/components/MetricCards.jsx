import { Card } from './ui/primitives.jsx';
import { toMbps, fmtMbps } from '../lib/utils.js';
import { rssiQuality, estimateDistance } from '../lib/signal.js';

// Generic metric card: label (13/400 muted) → value (24/500) → sublabel (12/400 muted).
function MetricCard({ label, value, unit, sublabel, valueColor }) {
  return (
    <Card>
      <div className="text-[13px] text-[var(--text-muted)]">{label}</div>
      <div
        className="mt-1 text-2xl font-medium tabular-nums leading-none"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
        {unit && <span className="ml-1 text-base text-[var(--text-muted)]">{unit}</span>}
      </div>
      <div className="mt-1.5 text-xs text-[var(--text-muted)]">{sublabel ?? ' '}</div>
    </Card>
  );
}

export function MetricCards({ wifi, throughput, latency }) {
  const rssi = wifi?.rssi;
  const q = rssiQuality(rssi);
  // wifi.band comes through as "2GHz"/"5GHz"/"6GHz" (see airportParse.js's
  // parseChannelValue), never "2.4GHz" with a decimal point — matching on
  // that literal would never fire, silently defaulting every 2.4GHz
  // connection to the 5GHz path-loss constant.
  const freq = wifi?.band?.startsWith('2') ? 2400 : 5200;
  const distance = estimateDistance(rssi, freq);
  const linkRate = wifi?.txRate ? `link ${wifi.txRate} Mbps` : null;

  const down = toMbps(throughput?.rxSec);
  const up = toMbps(throughput?.txSec);
  const ms = latency?.latencyMs;

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
      <MetricCard
        label="Signal"
        value={rssi != null ? rssi : '—'}
        unit={rssi != null ? 'dBm' : ''}
        sublabel={`${q.label}${distance != null ? ` · ~${distance}m away` : ''}`}
      />

      <MetricCard
        label="Download"
        value={fmtMbps(down)}
        unit="Mbps"
        sublabel={linkRate}
        valueColor="var(--series-download)"
      />
      <MetricCard
        label="Upload"
        value={fmtMbps(up)}
        unit="Mbps"
        sublabel={linkRate}
        valueColor="var(--series-upload)"
      />
      <MetricCard
        label="Latency"
        value={ms != null ? ms.toFixed(0) : '—'}
        unit={ms != null ? 'ms' : ''}
        sublabel={
          latency
            ? `${latency.packetLoss ?? 0}% loss ${
                latency.jitterMs != null ? `· ${latency.jitterMs}ms jitter` : ''
              }`
            : null
        }
      />
    </div>
  );
}

