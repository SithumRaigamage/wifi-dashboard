import { useEffect, useRef, useState, useCallback } from 'react';
import { playAlertSound } from '../lib/audioNotifier.js';

const MAX_POINTS = 60; // rolling buffer length for live charts
const MAX_EVENTS = 200;


// Single WebSocket connection that dispatches messages by `type` into state.
// Auto-reconnects with backoff. Also keeps rolling history buffers for charts,
// the live event log, and the shared settings object.
export function useLiveData() {
  const [status, setStatus] = useState('connecting'); // connecting | open | closed
  const [wifi, setWifi] = useState(null);
  const [throughput, setThroughput] = useState(null);
  const [latency, setLatency] = useState(null);
  const [devices, setDevices] = useState(null);
  const [speedtest, setSpeedtest] = useState(null);
  const [speedtestRunning, setSpeedtestRunning] = useState(false);
  const [connectedSince, setConnectedSince] = useState(null);
  const [dns, setDns] = useState(null);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(null);

  // History buffers for charts (arrays of { t, ... }).
  const [throughputHistory, setThroughputHistory] = useState([]);
  const [latencyHistory, setLatencyHistory] = useState([]);

  const wsRef = useRef(null);
  const retryRef = useRef(0);

  const handleMessage = useCallback((msg) => {
    const { type, data, timestamp } = msg;
    const t = new Date(timestamp).getTime();
    switch (type) {
      case 'wifi':
        setWifi(data);
        setConnectedSince((prev) => {
          if (!data.connected) return null;
          return prev ?? Date.now();
        });
        break;
      case 'throughput':
        setThroughput(data);
        setThroughputHistory((prev) =>
          [...prev, { t, rx: data.rxSec ?? 0, tx: data.txSec ?? 0 }].slice(-MAX_POINTS)
        );
        break;
      case 'latency':
        setLatency(data);
        setLatencyHistory((prev) =>
          [...prev, { t, ms: data.latencyMs ?? null, loss: data.packetLoss ?? 0 }].slice(-MAX_POINTS)
        );
        break;
      case 'devices':
        setDevices(data);
        break;
      case 'dns':
        setDns(data);
        break;
      case 'event':
        setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
        playAlertSound(data.severity);
        // Native Web Notification trigger if severity is warning or danger
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          (data.severity === 'warning' || data.severity === 'danger')
        ) {
          try {
            new Notification(`WiFi Alert: ${data.kind.toUpperCase()}`, {
              body: data.message,
              icon: '/favicon.ico',
            });
          } catch {
            /* notification blocked */
          }
        }
        break;


      case 'events-cleared':
        setEvents([]);
        break;
      case 'settings':
        setSettings(data);
        break;
      case 'speedtest':
        setSpeedtestRunning(Boolean(data.running));
        if (!data.running && data.download != null) setSpeedtest(data);
        break;
      default:
        break;
    }
  }, []);

  // REST fetch on mount so the dashboard paints with data immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, tp, lat, dev, set, evs] = await Promise.all([
          fetch('/api/wifi').then((r) => r.json()),
          fetch('/api/throughput').then((r) => r.json()),
          fetch('/api/latency').then((r) => r.json()),
          fetch('/api/devices').then((r) => r.json()),
          fetch('/api/settings').then((r) => r.json()),
          fetch('/api/events?limit=200').then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (w && Object.keys(w).length) {
          setWifi(w);
          if (w.connected) setConnectedSince((prev) => prev ?? Date.now());
        }
        if (tp && Object.keys(tp).length) setThroughput(tp);
        if (lat && Object.keys(lat).length) setLatency(lat);
        if (dev?.devices) setDevices(dev);
        if (set) setSettings(set);
        if (evs?.events) setEvents(evs.events);
        const st = await fetch('/api/speedtest').then((r) => r.json());
        if (!cancelled && st?.download != null) setSpeedtest(st);
      } catch {
        /* WS will populate shortly */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let closed = false;
    let reconnectTimer;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
      wsRef.current = ws;
      setStatus((s) => (s === 'open' ? s : 'connecting'));

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus('open');
      };
      ws.onmessage = (e) => {
        try {
          handleMessage(JSON.parse(e.data));
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        setStatus('closed');
        if (closed) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 10000);
        retryRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [handleMessage]);

  const rescanDevices = useCallback(async () => {
    try {
      await fetch('/api/devices/scan', { method: 'POST' });
    } catch {
      /* backend will also refresh on its own interval */
    }
  }, []);

  const runSpeedTest = useCallback(async () => {
    setSpeedtestRunning(true); // optimistic; WS confirms + clears
    try {
      const res = await fetch('/api/speedtest/run', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setSpeedtest(result);
      }
    } catch {
      /* ignore; button re-enables below */
    } finally {
      setSpeedtestRunning(false);
    }
  }, []);

  // Persist settings; the server echoes the merged result over WS ('settings').
  const saveSettings = useCallback(async (patch) => {
    setSettings((prev) => ({ ...prev, ...patch })); // optimistic
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) setSettings(await res.json());
    } catch {
      /* keep optimistic value */
    }
  }, []);

  const clearEvents = useCallback(async () => {
    setEvents([]);
    try {
      await fetch('/api/events', { method: 'DELETE' });
    } catch {
      /* ignore */
    }
  }, []);

  return {
    status,
    wifi,
    throughput,
    latency,
    devices,
    speedtest,
    speedtestRunning,
    connectedSince,
    dns,
    events,
    settings,
    throughputHistory,
    latencyHistory,
    rescanDevices,
    runSpeedTest,
    saveSettings,
    clearEvents,
  };
}
