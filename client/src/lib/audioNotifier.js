// audioNotifier.js — Web Audio API synthesizer for alert audio cues.

import { safeStorageGet, safeStorageSet } from './utils.js';

const SOUND_KEY = 'wifi-dashboard.sound';

export function isAudioEnabled() {
  return safeStorageGet(SOUND_KEY) === 'true';
}

export function setAudioEnabled(enabled) {
  safeStorageSet(SOUND_KEY, String(enabled));
}

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playAlertSound(severity = 'info') {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (severity === 'danger') {
    // Low double tone for critical events
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (severity === 'warning') {
    // Medium beep
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else {
    // Info / Success high soft chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }
}
