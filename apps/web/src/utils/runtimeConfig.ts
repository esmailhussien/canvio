export interface CanvioRuntimeConfig {
  apiUrl?: string;
  wsUrl?: string;
}

declare global {
  interface Window {
    CANVIO_CONFIG?: CanvioRuntimeConfig;
  }
}

export function getRuntimeConfig() {
  return window.CANVIO_CONFIG || {};
}

export function getApiBaseUrl() {
  return (
    getRuntimeConfig().apiUrl ||
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? '' : `${window.location.protocol}//${window.location.hostname}:4000`)
  ).replace(/\/$/, '');
}

export function getWebSocketUrl() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return (
    getRuntimeConfig().wsUrl ||
    import.meta.env.VITE_WS_URL ||
    `${wsProtocol}//${window.location.hostname}:4001`
  ).replace(/\/$/, '');
}
