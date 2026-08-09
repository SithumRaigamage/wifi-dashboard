// i18n.js — Internationalization translations and language store.

const LANG_KEY = 'wifi-dashboard.lang';

const TRANSLATIONS = {
  en: {
    overview: 'Overview',
    devices: 'Devices',
    floorplan: 'Floor Plan',
    history: 'History',
    diagnostics: 'Diagnostics',
    alerts: 'Alerts',
    settings: 'Settings',
    connected: 'Connected',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting…',
    healthScore: 'Health Score',
    signal: 'Signal',
    latency: 'Latency',
    download: 'Download',
    upload: 'Upload',
  },
  es: {
    overview: 'Resumen',
    devices: 'Dispositivos',
    floorplan: 'Plano',
    history: 'Historial',
    diagnostics: 'Diagnósticos',
    alerts: 'Alertas',
    settings: 'Ajustes',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    reconnecting: 'Reconectando…',
    healthScore: 'Puntuación de Salud',
    signal: 'Señal',
    latency: 'Latencia',
    download: 'Descarga',
    upload: 'Subida',
  },
  de: {
    overview: 'Übersicht',
    devices: 'Geräte',
    floorplan: 'Grundriss',
    history: 'Verlauf',
    diagnostics: 'Diagnose',
    alerts: 'Warnungen',
    settings: 'Einstellungen',
    connected: 'Verbunden',
    disconnected: 'Getrennt',
    reconnecting: 'Verbinden…',
    healthScore: 'Gesundheitswert',
    signal: 'Signal',
    latency: 'Latenz',
    download: 'Herunterladen',
    upload: 'Hochladen',
  },
  fr: {
    overview: 'Aperçu',
    devices: 'Appareils',
    floorplan: 'Plan du site',
    history: 'Historique',
    diagnostics: 'Diagnostics',
    alerts: 'Alertes',
    settings: 'Paramètres',
    connected: 'Connecté',
    disconnected: 'Déconnecté',
    reconnecting: 'Reconnexion…',
    healthScore: 'Score de Santé',
    signal: 'Signal',
    latency: 'Latence',
    download: 'Téléchargement',
    upload: 'Envoi',
  },
};

export function getLanguage() {
  try {
    return localStorage.getItem(LANG_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function setLanguage(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function t(key) {
  const lang = getLanguage();
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}
