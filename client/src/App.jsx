import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveData } from './hooks/useLiveData.js';
import { Sidebar } from './components/Sidebar.jsx';
import { Overview } from './sections/Overview.jsx';
import { Devices } from './sections/Devices.jsx';
import { FloorPlan } from './sections/FloorPlan.jsx';
import { History } from './sections/History.jsx';
import { Diagnostics } from './sections/Diagnostics.jsx';
import { Alerts } from './sections/Alerts.jsx';
import { Settings } from './sections/Settings.jsx';

const THEME_KEY = 'wifi-dashboard.theme';

function applyTheme(theme) {
  const el = document.documentElement;
  el.classList.remove('light', 'dark', 'oled', 'cyberpunk', 'emerald');
  if (theme && theme !== 'system') el.classList.add(theme);
}

const SECTIONS = ['overview', 'devices', 'floorplan', 'history', 'diagnostics', 'alerts', 'settings'];

function initialSection() {
  const q = new URLSearchParams(window.location.search).get('section');
  return SECTIONS.includes(q) ? q : 'overview';
}

export default function App() {
  const live = useLiveData();
  const [section, setSection] = useState(initialSection);
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'system');

  // Unread-alerts badge: count events that arrive while not viewing Alerts.
  const seenAtRef = useRef(Date.now());
  const unreadAlerts = useMemo(
    () => (live.events || []).filter((e) => e.ts > seenAtRef.current).length,
    [live.events, section]
  );

  useEffect(() => applyTheme(theme), [theme]);
  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  };

  const navigate = (id) => {
    if (id === 'alerts') seenAtRef.current = Date.now();
    setSection(id);
    const url = new URL(window.location.href);
    url.searchParams.set('section', id);
    window.history.replaceState(null, '', url);
  };

  const ssid = live.wifi?.ssid && live.wifi.ssid !== '<redacted>' ? live.wifi.ssid : null;

  const content = {
    overview: <Overview live={live} onNavigate={navigate} />,
    devices: <Devices live={live} />,
    floorplan: <FloorPlan live={live} />,
    history: <History />,
    diagnostics: <Diagnostics live={live} />,
    alerts: <Alerts live={live} />,
    settings: <Settings live={live} theme={theme} onTheme={setTheme} />,
  }[section];


  return (
    <div className="flex min-h-full">
      <Sidebar active={section} onSelect={navigate} ssid={ssid} unreadAlerts={unreadAlerts} />
      <main className="min-w-0 flex-1">
        <div className="w-full px-6 py-6 sm:px-8 lg:px-10">{content}</div>
      </main>
    </div>
  );
}

