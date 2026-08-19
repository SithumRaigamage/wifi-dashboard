import { Radio, Shield, Cpu, Wifi } from 'lucide-react';
import { Card, SectionHeader, Badge } from './ui/primitives.jsx';

export function BssidInspector({ wifi }) {
  if (!wifi) return null;

  // Unknown fields show '—', matching txRate/mcsIndex/channel below, rather
  // than a specific-looking fallback (a previous version showed "802.11ax
  // (Wi-Fi 6)", "80 MHz", "WPA2/WPA3 Personal" whenever the real value was
  // unavailable — a plausible-looking guess presented with the exact same
  // styling as a real measurement, which is wrong whenever the actual
  // hardware doesn't happen to match that guess).
  const fields = [
    { label: 'BSSID (MAC)', value: wifi.bssid || 'SSID/BSSID hidden by macOS Location permission', icon: Radio },
    { label: 'PHY Protocol Mode', value: wifi.phyMode || '—', icon: Cpu },
    { label: 'Channel & Band', value: wifi.channel ? `Ch ${wifi.channel}${wifi.band ? ` (${wifi.band})` : ''}` : '—', icon: Wifi },
    { label: 'Channel Width', value: wifi.channelWidth || '—', icon: ActivityIcon },
    { label: 'Link Transmit Rate', value: wifi.txRate ? `${wifi.txRate} Mbps` : '—', icon: Cpu },
    { label: 'MCS Index', value: wifi.mcsIndex != null ? `MCS ${wifi.mcsIndex}` : '—', icon: Cpu },
    { label: 'Security Standard', value: wifi.security || '—', icon: Shield },
  ];

  return (
    <Card>
      <SectionHeader>
        BSSID & Wireless Beacon Specs
      </SectionHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        {fields.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.label}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col justify-between"
            >
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium">
                <Icon size={14} className="text-blue-500" />
                <span>{f.label}</span>
              </div>
              <div className="mt-2 text-sm font-bold text-[var(--text-primary)] font-mono truncate">
                {f.value}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ActivityIcon(props) {
  return (
    <svg {...props} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
