import { useState, useEffect } from 'react';
import { ExternalLink, Wifi, ArrowDown, ArrowUp, X } from 'lucide-react';
import { Button } from './ui/primitives.jsx';
import { toMbps, fmtMbps } from '../lib/utils.js';

export function PipWidgetButton({ live }) {
  const [pipActive, setPipActive] = useState(false);
  const [showModalFallback, setShowModalFallback] = useState(false);

  const isPipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const togglePip = async () => {
    if (isPipSupported) {
      if (window.documentPictureInPicture.window) {
        window.documentPictureInPicture.window.close();
        setPipActive(false);
        return;
      }
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 320,
          height: 150,
        });

        // Copy Tailwind & custom styles to PIP window
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch {
            if (styleSheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = styleSheet.href;
              pipWin.document.head.appendChild(link);
            }
          }
        });

        // Container div inside PIP
        const container = pipWin.document.createElement('div');
        container.id = 'pip-root';
        pipWin.document.body.appendChild(container);
        pipWin.document.body.className = 'bg-zinc-950 text-white font-sans p-4 m-0 select-none overflow-hidden';

        const updatePipDom = () => {
          const down = fmtMbps(toMbps(live.throughput?.rxSec));
          const up = fmtMbps(toMbps(live.throughput?.txSec));
          const ms = live.latency?.latencyMs != null ? Math.round(live.latency.latencyMs) : '—';
          const ssid = live.wifi?.ssid || 'WiFi';

          container.innerHTML = `
            <div style="font-family: system-ui, sans-serif;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <span style="font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; tracking:1px;">${ssid}</span>
                <span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; background:#1e293b; color:#38bdf8;">${ms} ms</span>
              </div>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:8px;">
                <div style="background:#0f172a; padding:8px 12px; border-radius:8px; border:1px solid #334155;">
                  <div style="font-size:10px; color:#10b981; font-weight:700;">↓ DOWN</div>
                  <div style="font-size:18px; font-weight:800; color:#fff;">${down} <span style="font-size:10px; color:#64748b;">Mbps</span></div>
                </div>
                <div style="background:#0f172a; padding:8px 12px; border-radius:8px; border:1px solid #334155;">
                  <div style="font-size:10px; color:#3b82f6; font-weight:700;">↑ UP</div>
                  <div style="font-size:18px; font-weight:800; color:#fff;">${up} <span style="font-size:10px; color:#64748b;">Mbps</span></div>
                </div>
              </div>
            </div>
          `;
        };

        updatePipDom();
        setPipActive(true);

        const interval = setInterval(updatePipDom, 1000);
        pipWin.addEventListener('pagehide', () => {
          clearInterval(interval);
          setPipActive(false);
        });
      } catch {
        setShowModalFallback(true);
      }
    } else {
      setShowModalFallback(true);
    }
  };

  const down = fmtMbps(toMbps(live.throughput?.rxSec));
  const up = fmtMbps(toMbps(live.throughput?.txSec));
  const ms = live.latency?.latencyMs != null ? Math.round(live.latency.latencyMs) : '—';

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={togglePip}
        title="Floating Picture-in-Picture Mini HUD"
        className="flex items-center gap-1.5"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {pipActive ? 'PIP Active' : 'PiP HUD'}
      </Button>

      {showModalFallback && (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-2xl bg-zinc-900/95 text-white border border-zinc-800 shadow-2xl backdrop-blur w-72">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wifi size={14} className="text-blue-400 animate-pulse" /> Live Floating HUD
            </span>
            <button onClick={() => setShowModalFallback(false)} className="text-zinc-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-[10px] font-bold text-emerald-400">↓ DOWN</div>
              <div className="text-base font-extrabold text-white mt-0.5">{down} <span className="text-[10px] text-zinc-500 font-normal">Mbps</span></div>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-[10px] font-bold text-blue-400">↑ UP</div>
              <div className="text-base font-extrabold text-white mt-0.5">{up} <span className="text-[10px] text-zinc-500 font-normal">Mbps</span></div>
            </div>
          </div>
          <div className="mt-2 text-center text-xs font-mono text-amber-400 bg-amber-950/40 p-1.5 rounded-lg border border-amber-800/40">
            Latency Ping: {ms} ms
          </div>
        </div>
      )}
    </>
  );
}
