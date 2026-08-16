import { useState, useMemo } from 'react';
import { Router, ShieldCheck, AlertTriangle, HelpCircle, X } from 'lucide-react';
import { Card, Badge } from './ui/primitives.jsx';
import { getDeviceMeta, toggleDeviceTrust, setDeviceName } from '../lib/deviceStore.js';
import { autoName, isGatewayIp, deviceIcon } from '../lib/deviceMeta.js';


export function NetworkTopology({ devices = [], selfIp }) {
  const [selectedMac, setSelectedMac] = useState(null);
  const [storeTick, setStoreTick] = useState(0);

  // Node placement calculations
  const center = { x: 250, y: 180 };
  const radius = 130;

  const nodes = useMemo(() => {
    const list = devices.slice(0, 12); // display top 12 devices nicely
    const count = list.length;
    return list.map((dev, idx) => {
      const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);

      const isSelf = selfIp != null && dev.ip === selfIp;
      const isGateway = isGatewayIp(dev.ip);
      const meta = getDeviceMeta(dev.mac);
      const name = meta.name || autoName(dev, isSelf, isGateway);
      // Same OS-aware icon (US-21: Apple/AppWindow/Terminal/Tv when a guess
      // is available, falling back to randomizedMac/generic) already used by
      // the Devices list — this map used its own randomizedMac-only version,
      // so a device fingerprinted as e.g. Windows or Android showed the
      // correct icon in one view and a generic one here.
      const Icon = deviceIcon(dev, isSelf, isGateway);

      let statusColor = '#10b981'; // emerald
      if (dev.quality === 'fair') statusColor = '#f59e0b';
      if (dev.quality === 'weak') statusColor = '#f43f5e';
      if (dev.quality === 'unknown') statusColor = '#9ca3af';

      return {
        ...dev,
        x,
        y,
        name,
        meta,
        statusColor,
        isSelf,
        isGateway,
        Icon,
      };
    });
  }, [devices, selfIp, storeTick]);

  // Derived from `nodes` (not the raw `devices` prop) so it carries the same
  // isSelf/isGateway/name/meta enrichment every rendered node already has —
  // selectedMac can only ever be set by clicking one of those nodes anyway.
  const selectedDevice = useMemo(() => {
    return nodes.find((n) => n.mac === selectedMac);
  }, [nodes, selectedMac]);

  const handleToggleTrust = (mac) => {
    toggleDeviceTrust(mac);
    setStoreTick((t) => t + 1);
  };

  return (
    <Card className="relative overflow-hidden p-4 border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between mb-2 px-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Network Topology Map</h3>
          <p className="text-xs text-zinc-500">Real-time LAN node map & device trust topology</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Fast
          </span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Fair
          </span>
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Weak
          </span>
        </div>
      </div>

      <div className="relative w-full h-[360px] flex items-center justify-center overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 500 360">
          <defs>
            {/* Pulsing ring filter */}
            <radialGradient id="gatewayGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Gateway Pulse */}
          <circle cx={center.x} cy={center.y} r="45" fill="url(#gatewayGlow)" className="animate-pulse" />

          {/* Connection Lines */}
          {nodes.map((node) => (
            <line
              key={`line-${node.mac}`}
              x1={center.x}
              y1={center.y}
              x2={node.x}
              y2={node.y}
              stroke={node.statusColor}
              strokeWidth="2"
              strokeDasharray="4 3"
              opacity="0.7"
            />
          ))}

          {/* Gateway Center Node */}
          <g transform={`translate(${center.x}, ${center.y})`} className="cursor-pointer">
            <circle r="22" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="3" className="shadow-lg" />
            <foreignObject x="-12" y="-12" width="24" height="24">
              <div className="flex items-center justify-center w-full h-full text-white">
                <Router size={16} />
              </div>
            </foreignObject>
            <text
              y="34"
              textAnchor="middle"
              className="text-[11px] font-bold fill-zinc-900 dark:fill-zinc-100"
            >
              Gateway / Router
            </text>
          </g>

          {/* Device Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedMac === node.mac;
            return (
              <g
                key={`node-${node.mac}`}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedMac(node.mac)}
                className="cursor-pointer transition-transform hover:scale-110"
              >
                {/* Node Ring */}
                <circle
                  r="18"
                  fill={isSelected ? '#3b82f6' : '#ffffff'}
                  stroke={node.statusColor}
                  strokeWidth={isSelected ? '3' : '2'}
                  className="dark:fill-zinc-800 shadow-md"
                />

                {/* Device Icon */}
                <foreignObject x="-10" y="-10" width="20" height="20">
                  <div
                    className={`flex items-center justify-center w-full h-full ${
                      isSelected ? 'text-white' : 'text-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    <node.Icon size={14} />
                  </div>
                </foreignObject>

                {/* Trust Status Badge Icon */}
                {node.meta.trust === 'trusted' && (
                  <circle cx="12" cy="-12" r="6" fill="#10b981" />
                )}
                {node.meta.trust === 'suspect' && (
                  <circle cx="12" cy="-12" r="6" fill="#f43f5e" />
                )}

                {/* Label */}
                <text
                  y="28"
                  textAnchor="middle"
                  className="text-[10px] font-medium fill-zinc-800 dark:fill-zinc-200"
                >
                  {node.name.length > 12 ? `${node.name.slice(0, 10)}…` : node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Device Drawer / Modal Overlay */}
        {selectedDevice && (
          <div className="absolute bottom-3 left-3 right-3 p-4 rounded-xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-700 shadow-xl backdrop-blur flex items-center justify-between gap-4 z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <selectedDevice.Icon size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                    {selectedDevice.name}
                  </h4>
                  {selectedDevice.meta.trust === 'trusted' && (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0">Trusted</Badge>
                  )}
                  {selectedDevice.meta.trust === 'suspect' && (
                    <Badge variant="danger" className="text-[10px] px-1.5 py-0">Suspect</Badge>
                  )}
                </div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">
                  IP: {selectedDevice.ip} · MAC: {selectedDevice.mac} {selectedDevice.rttMs != null ? `· RTT: ${selectedDevice.rttMs}ms` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleTrust(selectedDevice.mac)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Toggle Trust State
              </button>
              <button
                onClick={() => setSelectedMac(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
