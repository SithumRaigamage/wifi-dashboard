import { useEffect, useState } from 'react';
import { Wifi, Maximize2 } from 'lucide-react';
import { Badge, Button } from './ui/primitives.jsx';
import { PipWidgetButton } from './PipWidget.jsx';
import { fmtDuration } from '../lib/utils.js';

// Returns null when there's genuinely nothing to show yet (e.g. phyMode
// hasn't come back from system_profiler right after connecting) rather than
// guessing a specific generation — an unrecognized-but-present phyMode string
// is shown verbatim instead of being forced into one of the known buckets.
function getWifiGeneration(phyMode, band) {
  if (!phyMode) return null;
  if (/be/i.test(phyMode)) return 'Wi-Fi 7';
  if (/ax/i.test(phyMode)) return band && /6/i.test(band) ? 'Wi-Fi 6E' : 'Wi-Fi 6';
  if (/ac/i.test(phyMode)) return 'Wi-Fi 5';
  if (/n/i.test(phyMode)) return 'Wi-Fi 4';
  return phyMode;
}

export function Header({ status, wifi, connectedSince, onKiosk, live }) {

  const [, tick] = useState(0);
  // Re-render each minute so the "connected for" duration stays current.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const uptimeSec = connectedSince ? Math.floor((Date.now() - connectedSince) / 1000) : null;

  const connected = wifi?.connected;
  const ssid = wifi?.ssid && wifi.ssid !== '<redacted>' ? wifi.ssid : null;
  const wifiGeneration = getWifiGeneration(wifi?.phyMode, wifi?.band);

  // Subtitle: "5 GHz · channel 44" from live wifi data.
  const subParts = [];
  if (wifi?.band) subParts.push(wifi.band.replace('GHz', ' GHz'));
  if (wifi?.channel != null) subParts.push(`channel ${wifi.channel}`);
  const subtitle = subParts.join(' · ');

  const isWsOpen = status === 'open';
  const badgeVariant = !connected ? 'danger' : isWsOpen ? 'success' : 'warning';
  const badgeText = !connected
    ? 'Disconnected'
    : isWsOpen
      ? `Connected${uptimeSec ? ` · ${fmtDuration(uptimeSec)}` : ''}`
      : 'Reconnecting…';


  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Wifi className="h-6 w-6 text-[var(--text-primary)]" strokeWidth={1.75} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-medium leading-tight text-[var(--text-primary)]">
              {ssid || (connected ? 'Wi-Fi' : 'Not connected')}
            </span>
            {connected && wifiGeneration && (
              <Badge variant="muted" className="text-[10px] font-bold py-0 text-blue-500 bg-blue-500/10">
                {wifiGeneration}
              </Badge>
            )}
          </div>
          <div className="text-[13px] text-[var(--text-muted)]">
            {subtitle || (connected ? 'SSID hidden by macOS' : 'Local network health')}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {live && <PipWidgetButton live={live} />}
        {onKiosk && (
          <Button size="sm" variant="outline" onClick={onKiosk} title="Open Kiosk View">
            <Maximize2 className="h-3.5 w-3.5" />
            Kiosk
          </Button>
        )}
        <Badge variant={badgeVariant} className="py-1">

          <span className="relative flex h-1.5 w-1.5">
            {isWsOpen && connected && (
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-current"
                style={{ animation: 'livepulse 2s ease-in-out infinite' }}
              />
            )}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          {badgeText}
        </Badge>
      </div>
    </header>
  );
}

