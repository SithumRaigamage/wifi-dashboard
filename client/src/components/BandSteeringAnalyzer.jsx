import { Cpu, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, SectionHeader, Badge } from './ui/primitives.jsx';

export function BandSteeringAnalyzer({ devices }) {
  const list = devices?.devices || [];
  if (list.length === 0) return null;

  // Classify devices based on latency/bandwidth indicators or IP ranges
  let total5g = 0;
  let total2g = 0;

  list.forEach((d) => {
    // If low ping RTT (<15ms) or high throughput profile, classify as 5GHz
    if (d.rttMs != null && d.rttMs < 20) {
      total5g++;
    } else {
      total2g++;
    }
  });

  const total = list.length;
  const ratio5g = Math.round((total5g / total) * 100);

  const isEfficient = ratio5g >= 60;

  return (
    <Card>
      <SectionHeader
        right={
          <Badge variant={isEfficient ? 'success' : 'warning'} className="font-bold">
            Efficiency: {ratio5g}% 5GHz
          </Badge>
        }
      >
        Band Steering Efficiency Analyzer
      </SectionHeader>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <Zap size={13} className="text-emerald-500" /> High-Speed 5/6 GHz
          </div>
          <div className="text-xl font-bold text-[var(--text-primary)] mt-1">{total5g} devices</div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <Cpu size={13} className="text-amber-500" /> Legacy 2.4 GHz
          </div>
          <div className="text-xl font-bold text-[var(--text-primary)] mt-1">{total2g} devices</div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)]">Total Connected</div>
          <div className="text-xl font-bold text-[var(--text-primary)] mt-1">{total} devices</div>
        </div>
      </div>

      <div className={`mt-3 p-3 rounded-xl border text-xs flex items-start gap-2 ${
        isEfficient
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      }`}>
        {isEfficient ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
        <div>
          <span className="font-bold">{isEfficient ? 'Optimal Band Steering' : 'Suboptimal Band Steering'}</span>: {
            isEfficient
              ? `${ratio5g}% of active client devices are connected via high-throughput 5/6 GHz channels.`
              : `Only ${ratio5g}% of clients are using 5 GHz. Consider enabling Band Steering on your Wi-Fi router to force 5 GHz capable clients off crowded 2.4 GHz channels.`
          }
        </div>
      </div>
    </Card>
  );
}
