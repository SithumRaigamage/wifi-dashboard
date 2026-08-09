import { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Wifi, Activity, ArrowDown, ArrowUp } from 'lucide-react';
import { calculateHealthScore } from '../lib/signal.js';
import { toMbps, fmtMbps } from '../lib/utils.js';

export function Kiosk({ live, onClose }) {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [hideCursor, setHideCursor] = useState(false);

  const health = calculateHealthScore(live);
  const down = toMbps(live.throughput?.rxSec);
  const up = toMbps(live.throughput?.txSec);
  const ms = live.latency?.latencyMs;

  useEffect(() => {
    let timer;
    const handleMouseMove = () => {
      setHideCursor(false);
      clearTimeout(timer);
      timer = setTimeout(() => setHideCursor(true), 3500);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-black text-white p-8 flex flex-col justify-between select-none ${
        hideCursor ? 'cursor-none' : 'cursor-auto'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wifi className="h-8 w-8 text-blue-500 animate-pulse" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {live.wifi?.ssid && live.wifi.ssid !== '<redacted>' ? live.wifi.ssid : 'WiFi Kiosk Monitor'}
            </h1>
            <p className="text-xs text-zinc-400">Live wall-mount network telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
            >
              Exit Kiosk
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-auto py-8">
        
        {/* Health Score Large Card */}
        <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-2xl text-center">
          <span className="text-xs font-bold tracking-widest uppercase text-zinc-400 mb-2">Wi-Fi Health Score</span>
          <div className="text-8xl font-black tracking-tight" style={{ color: health.color }}>
            {health.score}
          </div>
          <div className="mt-3 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider bg-zinc-800 text-white">
            {health.label}
          </div>
        </div>

        {/* Bandwidth Large Card */}
        <div className="flex flex-col justify-around p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <ArrowDown size={18} /> Download
            </div>
            <div className="text-4xl font-extrabold font-mono text-white">
              {fmtMbps(down)} <span className="text-sm font-normal text-zinc-500">Mbps</span>
            </div>
          </div>

          <hr className="border-zinc-800 my-4" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
              <ArrowUp size={18} /> Upload
            </div>
            <div className="text-4xl font-extrabold font-mono text-white">
              {fmtMbps(up)} <span className="text-sm font-normal text-zinc-500">Mbps</span>
            </div>
          </div>
        </div>

        {/* Latency & Signal Card */}
        <div className="flex flex-col justify-around p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800 shadow-2xl">
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-zinc-400">Ping RTT Latency</span>
            <div className="text-5xl font-extrabold font-mono text-amber-400 mt-2">
              {ms != null ? Math.round(ms) : '—'} <span className="text-lg font-normal text-zinc-500">ms</span>
            </div>
          </div>

          <hr className="border-zinc-800 my-4" />

          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-zinc-400">Signal Strength (RSSI)</span>
            <div className="text-3xl font-extrabold font-mono text-white mt-1">
              {live.wifi?.rssi ?? '—'} <span className="text-base font-normal text-zinc-500">dBm</span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Connected Devices: {live.devices?.count ?? 0}</span>
        <span>Auto-hiding cursor active · Press ESC to exit</span>
      </div>
    </div>
  );
}
