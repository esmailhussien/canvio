export interface CanvioRuntimeConfig {
  apiUrl?: string;
  wsUrl?: string;
  apiToken?: string;
}

declare global {
  interface Window {
    CANVIO_CONFIG?: CanvioRuntimeConfig;
  }
}

export function getRuntimeConfig() {
  return window.CANVIO_CONFIG || {};
}

function getViteEnv() {
  return (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env || {};
}

export function getApiBaseUrl() {
  const env = getViteEnv();
  return (
    getRuntimeConfig().apiUrl ||
    env.VITE_API_URL ||
    ''
  ).toString().replace(/\/$/, '');
}

export function getCanvioClientId() {
  const storageKey = 'canvio-client-id';
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const generated = window.crypto?.randomUUID?.() || `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return 'browser-session';
  }
}

export function getCanvioApiToken() {
  const env = getViteEnv();
  return (
    getRuntimeConfig().apiToken ||
    env.VITE_CANVIO_API_TOKEN ||
    ''
  ).toString().trim();
}

export function getCanvioShareToken() {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get('share')?.trim() || '';
  } catch {
    return '';
  }
}

export function getWebSocketUrl() {
  if (getRuntimeConfig().wsUrl) return getRuntimeConfig().wsUrl!.replace(/\/$/, '');
  const env = getViteEnv();
  const configuredWsUrl = typeof env.VITE_WS_URL === 'string' ? env.VITE_WS_URL : '';
  if (configuredWsUrl) return configuredWsUrl.replace(/\/$/, '');
  
  // Connect directly to local Canvio server in local development or on localhost/LAN
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || env.DEV)) {
    const hostname = window.location.hostname || 'localhost';
    return `ws://${hostname}:4001`;
  }

  // Connect to the official Canvio Render production backend
  return 'wss://canvio-l3bk.onrender.com';
}
