import { SectionHeader, Badge, Button } from './ui/primitives.jsx';
import { qualityMeta } from '../lib/signal.js';
import { deviceIcon, autoName, isGatewayIp } from '../lib/deviceMeta.js';
import { getDeviceMeta } from '../lib/deviceStore.js';

// Compact 3-4 row device preview for the Overview section, linking to Devices.
export function RecentDevices({ devices, onSeeAll }) {
  const list = devices?.devices ?? null;
  const selfIp = devices?.selfIp;
  const preview = list ? list.slice(0, 4) : null;

  return (
    <div>
      <SectionHeader
        right={
          <Button size="sm" variant="outline" onClick={onSeeAll}>
            See all{devices?.count != null ? ` · ${devices.count}` : ''}
          </Button>
        }
      >
        Recent devices
      </SectionHeader>

      <div className="rounded-[var(--radius-card)] bg-[var(--surface-1)] px-4">
        {!preview ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">Loading…</div>
        ) : preview.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">No devices found.</div>
        ) : (
          preview.map((d, i) => {
            const isSelf = d.ip === selfIp;
            const isGateway = isGatewayIp(d.ip);
            const Icon = deviceIcon(d, isSelf, isGateway);
            const q = qualityMeta(d.quality);
            const custom = getDeviceMeta(d.mac).name;
            return (
              <div
                key={d.mac + d.ip}
                className="flex items-center justify-between py-3"
                style={i < preview.length - 1 ? { borderBottom: '0.5px solid var(--border)' } : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <div>
                    <div className="text-sm text-[var(--text-primary)]">
                      {custom || autoName(d, isSelf, isGateway)}
                    </div>
                    <div className="text-xs tabular-nums text-[var(--text-muted)]">{d.ip}</div>
                  </div>
                </div>
                <Badge variant={q.variant}>{q.label}</Badge>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
