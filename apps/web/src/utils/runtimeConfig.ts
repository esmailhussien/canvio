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
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use custom configured URL, environment variable, or public Yjs demo provider fallback on production
  if (getRuntimeConfig().wsUrl) return getRuntimeConfig().wsUrl!.replace(/\/$/, '');
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL.replace(/\/$/, '');
  
  // Default fallback for Vercel / production static deployments where port 4001 backend is not running
  return `${wsProtocol}//demos.yjs.dev`;
}
