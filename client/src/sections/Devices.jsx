import { useState } from 'react';
import { RefreshCw, Check, Pencil, ShieldCheck, AlertTriangle, ScanSearch } from 'lucide-react';
import { SectionHeader, Badge, Button } from '../components/ui/primitives.jsx';
import { NetworkTopology } from '../components/NetworkTopology.jsx';
import { PortAudit } from '../components/PortAudit.jsx';
import { qualityMeta } from '../lib/signal.js';
import { deviceIcon, autoName, isGatewayIp, formatOs, showIotBadge } from '../lib/deviceMeta.js';
import { getDeviceMeta, setDeviceName, cycleDeviceTag, toggleDeviceTrust, TAGS } from '../lib/deviceStore.js';
import { fmtRelative, fmtDateTime } from '../lib/utils.js';

const TAG_VARIANT = { Work: 'success', Personal: 'warning', IoT: 'muted', Guest: 'danger' };


function DeviceRow({ d, isSelf, isGateway, last, onChange, auditing, onToggleAudit }) {
  const meta = getDeviceMeta(d.mac);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(meta.name);
  const Icon = deviceIcon(d, isSelf, isGateway);
  const q = qualityMeta(d.quality);
  const fallback = autoName(d, isSelf, isGateway);
  const osInfo = formatOs(d);

  const save = () => {
    setDeviceName(d.mac, draft.trim());
    setEditing(false);
    onChange();
  };

  return (
    <div
      className="py-3"
      style={!last ? { borderBottom: '0.5px solid var(--border)' } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {editing ? (
                <input
                  autoFocus
                  value={draft}
                  placeholder={fallback}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={save}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="w-40 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-1.5 py-0.5 text-sm text-[var(--text-primary)] outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(meta.name);
                    setEditing(true);
                  }}
                  className="group flex items-center gap-1.5 text-sm text-[var(--text-primary)]"
                >
                  <span className="truncate">{meta.name || fallback}</span>
                  <Pencil className="h-3 w-3 text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100" />
                </button>
              )}
              {isSelf && <span className="text-xs text-[var(--text-muted)]">(you)</span>}
              {editing && (
                <button type="button" onMouseDown={save} className="text-[var(--text-success)]">
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-[var(--text-muted)]">
              <span>{d.ip}</span>
              <span className="font-mono">· {d.mac}</span>
              {/* Show vendor when it isn't already what the name shows. */}
              {d.vendor && meta.name && meta.name !== d.vendor && <span>· {d.vendor}</span>}
              {osInfo && <span title={osInfo.title}>· {osInfo.label}</span>}
              {d.firstSeen && (
                <span title={`First seen ${fmtDateTime(d.firstSeen)}`}>· seen {fmtRelative(d.firstSeen)}</span>
              )}
              {d.lastSeen && <span>· active {fmtRelative(d.lastSeen)}</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              toggleDeviceTrust(d.mac);
              onChange();
            }}
            title="Click to toggle device trust state"
          >
            {meta.trust === 'trusted' && <Badge variant="success">Trusted</Badge>}
            {meta.trust === 'suspect' && <Badge variant="danger">Suspect</Badge>}
            {(!meta.trust || meta.trust === 'unknown') && <Badge variant="muted">+ trust</Badge>}
          </button>
          {d.randomizedMac && (
            <Badge variant="muted" title="Private/randomized MAC — likely a phone or laptop; no real vendor to look up">
              random MAC
            </Badge>
          )}
          {showIotBadge(d, meta) && (
            <Badge variant="muted" title="Guessed from vendor/hostname — check its port audit for a guest-isolation recommendation">
              IoT
            </Badge>
          )}
          <button
            type="button"
            onClick={() => {
              cycleDeviceTag(d.mac);
              onChange();
            }}
            title="Click to cycle tag"
          >
            <Badge variant={meta.tag ? TAG_VARIANT[meta.tag] : 'muted'}>{meta.tag || '+ tag'}</Badge>
          </button>
          <Badge variant={q.variant}>
            {q.label}
            {d.rttMs != null && d.quality !== 'unknown' && (
              <span className="opacity-70">{d.rttMs.toFixed(0)}ms</span>
            )}
          </Badge>
          <button
            type="button"
            onClick={onToggleAudit}
            title="Scan for open ports (SSH, HTTP, HTTPS, SMB, HTTP-alt)"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ScanSearch className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      {auditing && <PortAudit ip={d.ip} isIot={d.isIot} />}
    </div>
  );
}

export function Devices({ live }) {
  const { devices, rescanDevices } = live;
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState('All');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [, setVersion] = useState(0); // bump to re-read localStorage after edits
  const bump = () => setVersion((n) => n + 1);
  const [auditingMac, setAuditingMac] = useState(null); // mac of the row with its port-audit panel open
  const [rescanNotice, setRescanNotice] = useState(null);

  const list = devices?.devices ?? null;
  const selfIp = devices?.selfIp;

  const handleRescan = async () => {
    setScanning(true);
    setRescanNotice(null);
    const result = await rescanDevices?.();
    if (result && !result.ok) {
      setRescanNotice(
        result.status === 409
          ? 'A scan was already in progress — try again in a moment.'
          : "Rescan didn't go through — the next scheduled scan will still update this list."
      );
    }
    setTimeout(() => setScanning(false), 3000);
  };

  const filtered =
    list && filter !== 'All'
      ? list.filter((d) => getDeviceMeta(d.mac).tag === filter)
      : list;

  return (
    <div>
      <SectionHeader
        right={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-[var(--surface-2)] text-[var(--text-primary)] font-bold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)]'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-[var(--surface-2)] text-[var(--text-primary)] font-bold'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)]'
                }`}
              >
                Table
              </button>
            </div>
            <Button size="sm" variant="outline" onClick={handleRescan} disabled={scanning}>
              <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning' : 'Rescan'}
            </Button>
          </div>
        }
      >
        Connected devices{devices?.count != null ? ` · ${devices.count}` : ''}
      </SectionHeader>

      {rescanNotice && <p className="mb-2 text-xs text-[var(--text-warning)]">{rescanNotice}</p>}

      {/* Network Topology Visual Graph */}
      <div className="mb-4">
        <NetworkTopology devices={list || []} />
      </div>

      {/* Tag filter */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {['All', ...TAGS].map((t) => (
          <Button
            key={t}
            size="sm"
            variant="outline"
            onClick={() => setFilter(t)}
            className={
              filter === t
                ? 'border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-primary)]'
                : ''
            }
          >
            {t}
          </Button>
        ))}
      </div>


      <div className="rounded-[var(--radius-card)] bg-[var(--surface-1)] px-4 py-2">
        {!filtered ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">
            {filter === 'All' ? 'No devices found.' : `No devices tagged “${filter}”.`}
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-medium">
                  <th className="py-2.5 px-2">Device Name</th>
                  <th className="py-2.5 px-2">IP Address</th>
                  <th className="py-2.5 px-2">MAC Address</th>
                  <th className="py-2.5 px-2">Vendor</th>
                  <th className="py-2.5 px-2">OS</th>
                  <th className="py-2.5 px-2">Trust Status</th>
                  <th className="py-2.5 px-2">Tag</th>
                  <th className="py-2.5 px-2 text-right">Ping RTT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((d) => {
                  const meta = getDeviceMeta(d.mac);
                  const isSelf = d.ip === selfIp;
                  const isGateway = isGatewayIp(d.ip);
                  const name = meta.name || autoName(d, isSelf, isGateway);
                  const osInfo = formatOs(d);
                  return (
                    <tr key={d.mac + d.ip} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-2.5 px-2 font-medium text-[var(--text-primary)]">
                        {name} {isSelf && <span className="text-[var(--text-muted)] font-normal">(you)</span>}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[var(--text-muted)]">{d.ip}</td>
                      <td className="py-2.5 px-2 font-mono text-[var(--text-muted)]">{d.mac}</td>
                      <td className="py-2.5 px-2 text-[var(--text-muted)]">
                        {d.vendor || '—'}
                        {showIotBadge(d, meta) && (
                          <Badge variant="muted" className="ml-1.5" title="Guessed from vendor/hostname">
                            IoT
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-[var(--text-muted)]" title={osInfo?.title}>
                        {osInfo?.label || '—'}
                      </td>
                      <td className="py-2.5 px-2">
                        {meta.trust === 'trusted' && <Badge variant="success">Trusted</Badge>}
                        {meta.trust === 'suspect' && <Badge variant="danger">Suspect</Badge>}
                        {(!meta.trust || meta.trust === 'unknown') && <Badge variant="muted">Unknown</Badge>}
                      </td>
                      <td className="py-2.5 px-2">
                        {meta.tag ? <Badge variant={TAG_VARIANT[meta.tag]}>{meta.tag}</Badge> : '—'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-medium">
                        {d.rttMs != null ? `${d.rttMs.toFixed(0)} ms` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          filtered.map((d, i) => (
            <DeviceRow
              key={d.mac + d.ip}
              d={d}
              isSelf={d.ip === selfIp}
              isGateway={isGatewayIp(d.ip)}
              last={i === filtered.length - 1}
              onChange={bump}
              auditing={auditingMac === d.mac}
              onToggleAudit={() => setAuditingMac((cur) => (cur === d.mac ? null : d.mac))}
            />
          ))
        )}
      </div>

      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Names and tags are saved locally in this browser, keyed by MAC address.
      </p>
    </div>
  );
}
