import { useEffect, useState } from 'react';
import { Wifi } from 'lucide-react';
import { Badge } from './ui/primitives.jsx';
import { fmtDuration } from '../lib/utils.js';

export function Header({ status, wifi, connectedSince }) {
  const [, tick] = useState(0);
  // Re-render each minute so the "connected for" duration stays current.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const uptimeSec = connectedSince ? Math.floor((Date.now() - connectedSince) / 1000) : null;

  const connected = wifi?.connected;
  const ssid = wifi?.ssid && wifi.ssid !== '<redacted>' ? wifi.ssid : null;

  // Subtitle: "5 GHz · channel 44" from live wifi data.
  const subParts = [];
  if (wifi?.band) subParts.push(wifi.band.replace('GHz', ' GHz'));
  if (wifi?.channel != null) subParts.push(`channel ${wifi.channel}`);
  const subtitle = subParts.join(' · ');

  const live = status === 'open';
  const badgeVariant = !connected ? 'danger' : live ? 'success' : 'warning';
  const badgeText = !connected
    ? 'Disconnected'
    : live
      ? `Connected${uptimeSec ? ` · ${fmtDuration(uptimeSec)}` : ''}`
      : 'Reconnecting…';

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Wifi className="h-6 w-6 text-[var(--text-primary)]" strokeWidth={1.75} />
        <div>
          <div className="text-base font-medium leading-tight text-[var(--text-primary)]">
            {ssid || (connected ? 'Wi-Fi' : 'Not connected')}
          </div>
          <div className="text-[13px] text-[var(--text-muted)]">
            {subtitle || (connected ? 'SSID hidden by macOS' : 'Local network health')}
          </div>
        </div>
      </div>

      <Badge variant={badgeVariant} className="py-1">
        <span className="relative flex h-1.5 w-1.5">
          {live && connected && (
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-current"
              style={{ animation: 'livepulse 2s ease-in-out infinite' }}
            />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        {badgeText}
      </Badge>
    </header>
  );
}
