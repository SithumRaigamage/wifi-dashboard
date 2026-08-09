import { Wifi, LayoutDashboard, MonitorSmartphone, LineChart, Stethoscope, Bell, Settings } from 'lucide-react';
import { cn } from '../lib/utils.js';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
  { id: 'history', label: 'History', icon: LineChart },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ active, onSelect, ssid, unreadAlerts = 0 }) {
  return (
    <nav
      className="flex w-14 shrink-0 flex-col gap-1 px-2 py-4 md:w-[168px] md:px-3"
      style={{ borderRight: '0.5px solid var(--border)' }}
    >
      {/* Logo row */}
      <div className="mb-3 flex items-center gap-2 px-1.5 md:px-2">
        <Wifi className="h-5 w-5 shrink-0 text-[var(--text-primary)]" strokeWidth={1.75} />
        <span className="hidden truncate text-base font-medium text-[var(--text-primary)] md:inline">
          {ssid || 'Wi-Fi'}
        </span>
      </div>

      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        const showBadge = item.id === 'alerts' && unreadAlerts > 0;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => onSelect(item.id)}
            className={cn(
              'flex items-center gap-2.5 rounded-[var(--radius)] px-2 py-2 text-sm transition',
              'justify-center md:justify-start',
              isActive
                ? 'bg-[var(--surface-2)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-1)]'
            )}
          >
            <span className="relative">
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {/* Icon-only (collapsed) badge dot */}
              {showBadge && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--text-danger)] md:hidden" />
              )}
            </span>
            <span className="hidden md:inline">{item.label}</span>
            {showBadge && (
              <span className="ml-auto hidden rounded-full bg-[var(--bg-danger)] px-1.5 text-xs text-[var(--text-danger)] md:inline">
                {unreadAlerts}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
