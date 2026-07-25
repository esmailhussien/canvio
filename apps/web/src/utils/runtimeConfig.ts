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
    ''
  ).replace(/\/$/, '');
}

export function getWebSocketUrl() {
  if (getRuntimeConfig().wsUrl) return getRuntimeConfig().wsUrl!.replace(/\/$/, '');
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL.replace(/\/$/, '');
  
  // Connect directly to local Canvio server in local development or on localhost
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || import.meta.env.DEV)) {
    return 'ws://localhost:4001';
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//demos.yjs.dev`;
}
