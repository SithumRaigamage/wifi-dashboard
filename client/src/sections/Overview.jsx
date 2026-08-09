import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Move, RotateCcw, Check, SlidersHorizontal } from 'lucide-react';
import { Header } from '../components/Header.jsx';
import { HealthGauge } from '../components/HealthGauge.jsx';
import { MetricCards } from '../components/MetricCards.jsx';
import { ThroughputChart } from '../components/ThroughputChart.jsx';
import { LatencyTrend } from '../components/LatencyTrend.jsx';
import { SpeedTestCard } from '../components/SpeedTestCard.jsx';
import { UsageHistory } from '../components/UsageHistory.jsx';
import { RecentDevices } from '../components/RecentDevices.jsx';
import { Button } from '../components/ui/primitives.jsx';
import { Kiosk } from './Kiosk.jsx';

const DEFAULT_ORDER = ['health', 'metrics', 'throughput', 'latency_speedtest', 'history', 'devices'];
const LAYOUT_KEY = 'wifi-dashboard.overview-layout';

function getStoredOrder() {
  try {
    const stored = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (Array.isArray(stored) && stored.length === DEFAULT_ORDER.length) return stored;
  } catch {
    /* fallback to default */
  }
  return DEFAULT_ORDER;
}

export function Overview({ live, onNavigate }) {
  const [showKiosk, setShowKiosk] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [cardOrder, setCardOrder] = useState(getStoredOrder);
  const [draggedIdx, setDraggedIdx] = useState(null);

  const {
    status,
    wifi,
    throughput,
    latency,
    devices,
    speedtest,
    speedtestRunning,
    connectedSince,
    throughputHistory,
    latencyHistory,
    runSpeedTest,
  } = live;

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(cardOrder));
    } catch {
      /* ignore */
    }
  }, [cardOrder]);

  const moveCard = (idx, direction) => {
    const newOrder = [...cardOrder];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    const temp = newOrder[idx];
    newOrder[idx] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setCardOrder(newOrder);
  };

  const handleDragStart = (idx) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newOrder = [...cardOrder];
    const item = newOrder.splice(draggedIdx, 1)[0];
    newOrder.splice(idx, 0, item);
    setDraggedIdx(idx);
    setCardOrder(newOrder);
  };

  const resetLayout = () => {
    setCardOrder(DEFAULT_ORDER);
  };

  const renderWidget = (key) => {
    switch (key) {
      case 'health':
        return <HealthGauge live={live} />;
      case 'metrics':
        return <MetricCards wifi={wifi} throughput={throughput} latency={latency} />;
      case 'throughput':
        return <ThroughputChart history={throughputHistory} />;
      case 'latency_speedtest':
        return (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <LatencyTrend latency={latency} history={latencyHistory} />
            <SpeedTestCard speedtest={speedtest} running={speedtestRunning} onRun={runSpeedTest} />
          </div>
        );
      case 'history':
        return <UsageHistory />;
      case 'devices':
        return <RecentDevices devices={devices} onSeeAll={() => onNavigate('devices')} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {showKiosk && <Kiosk live={live} onClose={() => setShowKiosk(false)} />}
      
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Header status={status} wifi={wifi} connectedSince={connectedSince} onKiosk={() => setShowKiosk(true)} />
        </div>
        <div className="ml-3 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-1.5"
          >
            {editMode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
            {editMode ? 'Done' : 'Customize Layout'}
          </Button>
        </div>
      </div>

      {editMode && (
        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs flex items-center justify-between">
          <span className="text-blue-900 dark:text-blue-200 font-medium">
            Drag cards or use arrow buttons to reorder Overview widgets.
          </span>
          <Button size="sm" variant="outline" onClick={resetLayout} className="flex items-center gap-1 text-[11px]">
            <RotateCcw className="h-3 w-3" /> Reset Layout
          </Button>
        </div>
      )}

      {cardOrder.map((key, idx) => (
        <div
          key={key}
          draggable={editMode}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={() => setDraggedIdx(null)}
          className={`relative transition-all ${
            editMode
              ? 'p-2 rounded-2xl border-2 border-dashed border-blue-400/50 bg-blue-500/5 cursor-grab active:cursor-grabbing'
              : ''
          }`}
        >
          {editMode && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-zinc-900/90 text-white p-1 rounded-lg shadow-lg">
              <button
                type="button"
                onClick={() => moveCard(idx, -1)}
                disabled={idx === 0}
                className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => moveCard(idx, 1)}
                disabled={idx === cardOrder.length - 1}
                className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30"
              >
                <ArrowDown size={14} />
              </button>
              <span className="px-1 text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                <Move size={12} /> {idx + 1}
              </span>
            </div>
          )}
          {renderWidget(key)}
        </div>
      ))}
    </div>
  );
}



