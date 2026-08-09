import { useState } from 'react';
import { Header } from '../components/Header.jsx';
import { HealthGauge } from '../components/HealthGauge.jsx';
import { MetricCards } from '../components/MetricCards.jsx';
import { ThroughputChart } from '../components/ThroughputChart.jsx';
import { LatencyTrend } from '../components/LatencyTrend.jsx';
import { SpeedTestCard } from '../components/SpeedTestCard.jsx';
import { UsageHistory } from '../components/UsageHistory.jsx';
import { RecentDevices } from '../components/RecentDevices.jsx';
import { Kiosk } from './Kiosk.jsx';

// The original MVP dashboard, now the Overview section. Only mounts while
// Overview is the active section, so its live charts stop when you navigate away.
export function Overview({ live, onNavigate }) {
  const [showKiosk, setShowKiosk] = useState(false);

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

  return (
    <div className="flex flex-col gap-3">
      {showKiosk && <Kiosk live={live} onClose={() => setShowKiosk(false)} />}
      <Header status={status} wifi={wifi} connectedSince={connectedSince} onKiosk={() => setShowKiosk(true)} />
      <HealthGauge live={live} />
      <MetricCards wifi={wifi} throughput={throughput} latency={latency} />
      <ThroughputChart history={throughputHistory} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <LatencyTrend latency={latency} history={latencyHistory} />
        <SpeedTestCard speedtest={speedtest} running={speedtestRunning} onRun={runSpeedTest} />
      </div>
      <UsageHistory />
      <RecentDevices devices={devices} onSeeAll={() => onNavigate('devices')} />
    </div>
  );
}


