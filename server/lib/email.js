// email.js — SMTP alert emails via nodemailer.
//
// Connection host/port/user/from/to/secure come from Settings (editable in the
// UI); the SMTP *password* comes only from the SMTP_PASS env var so it's never
// written to settings.json. Sending is best-effort and fully guarded: if email
// alerts are off or SMTP isn't configured, send() is a no-op.

import nodemailer from 'nodemailer';
import { getSettings } from './settings.js';
import { scoped } from './logger.js';

const log = scoped('email');

let transporter = null;
let signature = ''; // config fingerprint; rebuild the transporter when it changes

function buildTransport(s) {
  const pass = process.env.SMTP_PASS || '';
  const sig = JSON.stringify([s.smtpHost, s.smtpPort, s.smtpUser, s.smtpSecure, Boolean(pass)]);
  if (transporter && sig === signature) return transporter;
  if (!s.smtpHost) {
    transporter = null;
    signature = sig;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: s.smtpHost,
    port: Number(s.smtpPort) || 587,
    secure: Boolean(s.smtpSecure), // true for 465, false for 587/STARTTLS
    auth: s.smtpUser ? { user: s.smtpUser, pass } : undefined,
  });
  signature = sig;
  return transporter;
}

export function emailConfigured(s = getSettings()) {
  return Boolean(s.emailAlerts && s.smtpHost && s.emailTo);
}

// Send an alert email. Returns true if handed to SMTP, false if skipped/failed.
export async function sendAlertEmail(subject, text) {
  const s = getSettings();
  if (!emailConfigured(s)) return false;
  const tx = buildTransport(s);
  if (!tx) return false;
  try {
    await tx.sendMail({
      from: s.emailFrom || s.smtpUser || 'wifi-dashboard@localhost',
      to: s.emailTo,
      subject,
      text,
    });
    log.info(`alert email sent to ${s.emailTo}`, { subject });
    return true;
  } catch (err) {
    log.error(`send failed: ${err.message}`);
    return false;
  }
}

// Used by the Settings "send test email" affordance.
export async function sendTestEmail() {
  const s = getSettings();
  const tx = buildTransport(s);
  if (!s.smtpHost || !s.emailTo || !tx) {
    throw new Error('SMTP host and a recipient (To) are required');
  }
  await tx.sendMail({
    from: s.emailFrom || s.smtpUser || 'wifi-dashboard@localhost',
    to: s.emailTo,
    subject: 'WiFi Dashboard — test email',
    text: 'This is a test alert from your WiFi Dashboard. Email notifications are working.',
  });
  return true;
}
