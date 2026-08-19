import { Cpu, Zap, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, SectionHeader, Badge } from './ui/primitives.jsx';

// Real per-device WiFi band isn't visible without router access — the same
// limitation the README already documents honestly for the LAN RTT quality
// pill ("no per-device WiFi RSSI without router access... LAN RTT is the
// honest, locally-measurable proxy"). ARP-based LAN discovery has no way to
// know which radio a device actually associated on, so this estimates it
// from ping RTT instead (fast LAN responders are more likely on a fast
// band) and labels every number as an estimate, not a measured band split.
const FAST_RTT_THRESHOLD_MS = 20;

export function BandSteeringAnalyzer({ devices }) {
  const list = devices?.devices || [];
  if (list.length === 0) return null;

  let fastResponders = 0;
  let slowResponders = 0;
  let noReply = 0;

  list.forEach((d) => {
    // A device with no RTT at all (unreachable/asleep/filtered) has zero
    // evidence about its speed — folding it into "slow" would mean an
    // unrelated non-responder count pulls down the estimate and can trigger
    // a false "many slow-responding devices" warning that has nothing to do
    // with band, undermining the honesty this estimate is meant to have.
    if (d.rttMs == null) {
      noReply++;
    } else if (d.rttMs < FAST_RTT_THRESHOLD_MS) {
      fastResponders++;
    } else {
      slowResponders++;
    }
  });

  const total = list.length;
  const known = fastResponders + slowResponders;
  const ratioFast = known > 0 ? Math.round((fastResponders / known) * 100) : null;

  const isEfficient = ratioFast != null && ratioFast >= 60;

  return (
    <Card>
      <SectionHeader
        right={
          ratioFast != null ? (
            <Badge variant={isEfficient ? 'success' : 'warning'} className="font-bold">
              ~{ratioFast}% fast-responding
            </Badge>
          ) : (
            <Badge variant="muted" className="font-bold">
              No responding devices yet
            </Badge>
          )
        }
      >
        Band Distribution Estimate
      </SectionHeader>
      <div className="mt-1 flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>
          Estimated from LAN ping response time, not a measured WiFi band — this app can't see which
          radio a device actually associated on without router access.
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <Zap size={13} className="text-emerald-500" /> Fast responders (est. 5/6 GHz)
          </div>
          <div className="text-xl font-bold text-[var(--text-primary)] mt-1">{fastResponders} devices</div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <Cpu size={13} className="text-amber-500" /> Slower responders (est. 2.4 GHz)
          </div>
          <div className="text-xl font-bold text-[var(--text-primary)] mt-1">{slowResponders} devices</div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)]">Total Connected</div>
          <div className="text-xl font-bold text-[var(--text-primary)] mt-1">{total} devices</div>
          {noReply > 0 && (
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{noReply} not replying — excluded from the estimate</div>
          )}
        </div>
      </div>

      {ratioFast != null && (
        <div className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2 ${
          isEfficient
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {isEfficient ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
          <div>
            <span className="font-bold">{isEfficient ? 'Mostly fast-responding' : 'Many slow-responding devices'}</span>: {
              isEfficient
                ? `~${ratioFast}% of devices respond quickly on the LAN — consistent with (but not proof of) most clients being on a fast band.`
                : `Only ~${ratioFast}% of devices respond quickly. If your router supports Band Steering, enabling it can help capable clients move off a crowded 2.4 GHz band — but check this estimate against your router's own client list before acting on it.`
            }
          </div>
        </div>
      )}
    </Card>
  );
}
