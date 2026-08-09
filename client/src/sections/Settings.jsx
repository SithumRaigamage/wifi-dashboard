import { useEffect, useState } from 'react';
import { Card, SectionHeader, Input, Select, Toggle, Button } from '../components/ui/primitives.jsx';

// One labelled control row inside a settings card.
function Row({ label, hint, control }) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: '0.5px solid var(--border)' }}
    >
      <div className="min-w-0">
        <div className="text-sm text-[var(--text-primary)]">{label}</div>
        {hint && <div className="text-xs text-[var(--text-muted)]">{hint}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

// Email alerts card. Text fields buffer locally and persist on blur; the SMTP
// password is set in server/.env, not here. Includes a "Send test" affordance.
function EmailCard({ settings, saveSettings }) {
  const [f, setF] = useState({});
  const [test, setTest] = useState({ state: 'idle', msg: '' });

  useEffect(() => {
    if (settings) {
      setF({
        smtpHost: settings.smtpHost ?? '',
        smtpPort: settings.smtpPort ?? 587,
        smtpUser: settings.smtpUser ?? '',
        emailFrom: settings.emailFrom ?? '',
        emailTo: settings.emailTo ?? '',
      });
    }
  }, [settings]);

  const commit = (key, cast = (x) => x) => () => {
    const val = cast(f[key]);
    if (val !== settings[key]) saveSettings({ [key]: val });
  };
  const textField = (key, cast) => ({
    value: f[key] ?? '',
    onChange: (e) => setF((p) => ({ ...p, [key]: e.target.value })),
    onBlur: commit(key, cast),
    onKeyDown: (e) => e.key === 'Enter' && e.currentTarget.blur(),
  });

  const runTest = async () => {
    setTest({ state: 'sending', msg: '' });
    try {
      const res = await fetch('/api/email/test', { method: 'POST' });
      const json = await res.json();
      if (res.ok) setTest({ state: 'ok', msg: 'Test email sent.' });
      else setTest({ state: 'err', msg: json.error || 'Failed to send.' });
    } catch {
      setTest({ state: 'err', msg: 'Failed to send.' });
    }
  };

  return (
    <Card className="py-0">
      <Row
        label="Email alerts"
        hint="Send email on warning/danger events (like the webhook). Password: SMTP_PASS in server/.env."
        control={<Toggle checked={settings.emailAlerts} onChange={(v) => saveSettings({ emailAlerts: v })} />}
      />
      <Row
        label="SMTP host"
        hint="e.g. smtp.gmail.com"
        control={<Input className="w-56" placeholder="smtp.example.com" {...textField('smtpHost')} />}
      />
      <Row
        label="SMTP port"
        hint="587 (STARTTLS) or 465 (SSL)."
        control={
          <div className="flex items-center gap-2">
            <Input className="w-20" type="number" {...textField('smtpPort', (v) => Number(v) || 587)} />
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              SSL
              <Toggle checked={settings.smtpSecure} onChange={(v) => saveSettings({ smtpSecure: v })} />
            </span>
          </div>
        }
      />
      <Row
        label="SMTP username"
        hint="Often the same as the From address."
        control={<Input className="w-56" {...textField('smtpUser')} />}
      />
      <Row
        label="From"
        hint="From header (defaults to the username)."
        control={<Input className="w-56" type="email" placeholder="alerts@example.com" {...textField('emailFrom')} />}
      />
      <Row
        label="To"
        hint="Recipient for alert emails."
        control={<Input className="w-56" type="email" placeholder="you@example.com" {...textField('emailTo')} />}
      />
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="text-xs text-[var(--text-muted)]">
          {test.state === 'ok' && <span className="text-[var(--text-success)]">{test.msg}</span>}
          {test.state === 'err' && <span className="text-[var(--text-danger)]">{test.msg}</span>}
          {test.state === 'sending' && 'Sending…'}
        </div>
        <Button variant="outline" size="sm" onClick={runTest} disabled={test.state === 'sending'}>
          Send test email
        </Button>
      </div>
    </Card>
  );
}

export function Settings({ live, theme, onTheme }) {
  const { settings, saveSettings } = live;
  const [pingHost, setPingHost] = useState('');
  const [webhook, setWebhook] = useState('');

  useEffect(() => {
    if (settings) {
      setPingHost(settings.pingHost ?? '');
      setWebhook(settings.webhookUrl ?? '');
    }
  }, [settings]);

  if (!settings) {
    return (
      <div>
        <SectionHeader>Settings</SectionHeader>
        <Card>
          <div className="py-4 text-center text-xs text-[var(--text-muted)]">Loading…</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader>Settings</SectionHeader>

      <Card className="py-0">
        <Row
          label="Polling interval"
          hint="How often throughput is sampled."
          control={
            <Select
              value={String(settings.throughputInterval)}
              onChange={(e) => saveSettings({ throughputInterval: Number(e.target.value) })}
            >
              <option value="1000">1 second</option>
              <option value="2000">2 seconds</option>
              <option value="5000">5 seconds</option>
              <option value="10000">10 seconds</option>
            </Select>
          }
        />
        <Row
          label="Ping target host"
          hint="Host used for latency + packet-loss."
          control={
            <Input
              className="w-40"
              value={pingHost}
              onChange={(e) => setPingHost(e.target.value)}
              onBlur={() => pingHost && pingHost !== settings.pingHost && saveSettings({ pingHost })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          }
        />
        <Row
          label="Data retention"
          hint="Raw samples are kept this long; hourly rollups persist longer."
          control={
            <Select
              value={String(settings.retentionHours)}
              onChange={(e) => saveSettings({ retentionHours: Number(e.target.value) })}
            >
              <option value="6">6 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </Select>
          }
        />
        <Row
          label="Theme"
          hint="Follows your OS by default."
          control={
            <Select value={theme} onChange={(e) => onTheme(e.target.value)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          }
        />
      </Card>

      <Card className="py-0">
        <Row
          label="Online device-vendor lookup"
          hint="Resolve unknown device manufacturers via macvendors.com (cached). Sends only the MAC prefix."
          control={
            <Toggle
              checked={settings.onlineVendorLookup}
              onChange={(v) => saveSettings({ onlineVendorLookup: v })}
            />
          }
        />
        <Row
          label="Public read-only status page"
          hint="Exposes /api/status/public — an up/down summary with no device or config detail."
          control={
            <Toggle checked={settings.publicStatus} onChange={(v) => saveSettings({ publicStatus: v })} />
          }
        />
        <Row
          label="Push alerts to Slack/Discord"
          hint="POST warning/danger events to the webhook below."
          control={
            <Toggle checked={settings.pushAlerts} onChange={(v) => saveSettings({ pushAlerts: v })} />
          }
        />
        <Row
          label="Webhook URL"
          hint="Slack or Discord incoming webhook."
          control={
            <Input
              className="w-56"
              type="url"
              placeholder="https://hooks.slack.com/…"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              onBlur={() => webhook !== settings.webhookUrl && saveSettings({ webhookUrl: webhook })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          }
        />
      </Card>

      <EmailCard settings={settings} saveSettings={saveSettings} />
    </div>
  );
}
