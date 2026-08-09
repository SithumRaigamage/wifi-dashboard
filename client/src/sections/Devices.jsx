import { useState } from 'react';
import { RefreshCw, Check, Pencil, ShieldCheck, AlertTriangle } from 'lucide-react';
import { SectionHeader, Badge, Button } from '../components/ui/primitives.jsx';
import { NetworkTopology } from '../components/NetworkTopology.jsx';
import { qualityMeta } from '../lib/signal.js';
import { deviceIcon, autoName, isGatewayIp } from '../lib/deviceMeta.js';
import { getDeviceMeta, setDeviceName, cycleDeviceTag, toggleDeviceTrust, TAGS } from '../lib/deviceStore.js';
import { fmtRelative, fmtDateTime } from '../lib/utils.js';

const TAG_VARIANT = { Work: 'success', Personal: 'warning', IoT: 'muted', Guest: 'danger' };


function DeviceRow({ d, isSelf, isGateway, last, onChange }) {
  const meta = getDeviceMeta(d.mac);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(meta.name);
  const Icon = deviceIcon(d, isSelf, isGateway);
  const q = qualityMeta(d.quality);
  const fallback = autoName(d, isSelf, isGateway);

  const save = () => {
    setDeviceName(d.mac, draft.trim());
    setEditing(false);
    onChange();
  };

  return (
    <div
      className="flex items-center justify-between gap-3 py-3"
      style={!last ? { borderBottom: '0.5px solid var(--border)' } : undefined}
    >
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
      </div>
    </div>
  );
}

export function Devices({ live }) {
  const { devices, rescanDevices } = live;
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState('All');
  const [, setVersion] = useState(0); // bump to re-read localStorage after edits
  const bump = () => setVersion((n) => n + 1);

  const list = devices?.devices ?? null;
  const selfIp = devices?.selfIp;

  const handleRescan = async () => {
    setScanning(true);
    await rescanDevices?.();
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
          <Button size="sm" variant="outline" onClick={handleRescan} disabled={scanning}>
            <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning' : 'Rescan'}
          </Button>
        }
      >
        Connected devices{devices?.count != null ? ` · ${devices.count}` : ''}
      </SectionHeader>

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


      <div className="rounded-[var(--radius-card)] bg-[var(--surface-1)] px-4">
        {!filtered ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)]">
            {filter === 'All' ? 'No devices found.' : `No devices tagged “${filter}”.`}
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
