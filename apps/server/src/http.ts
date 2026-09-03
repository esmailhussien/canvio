import type { FastifyInstance } from 'fastify';

function readPositiveIntEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// In production we sit behind exactly one proxy hop (Render). Trusting the
// whole chain (`true`) would let clients spoof their IP via x-forwarded-for.
const TRUST_PROXY_HOPS = readPositiveIntEnv('CANVIO_TRUST_PROXY_HOPS', 1);

// Strip query strings before logging: share/API tokens travel in URLs.
function serializeRequestForLog(req: { method?: string; url?: string }) {
  let pathname = req.url || '';
  const queryIndex = pathname.indexOf('?');
  if (queryIndex !== -1) pathname = pathname.slice(0, queryIndex);
  return { method: req.method, url: pathname };
}

export const FASTIFY_OPTIONS = {
  logger: {
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-canvio-api-key"]',
        'req.headers["x-canvio-share-token"]',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req: serializeRequestForLog,
    },
  },
  bodyLimit: 256 * 1024,
  requestTimeout: 30_000,
  trustProxy: process.env.NODE_ENV === 'production' ? TRUST_PROXY_HOPS : false,
};

const API_CSP = "default-src 'none'; frame-ancestors 'none'; form-action 'none'";

const WEB_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://server.arcgisonline.com https://quickchart.io",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss: https:",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

export function registerSecurityHeaders(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const pathname = (request.url || '').split('?')[0];
    const isApi = pathname === '/api' || pathname.startsWith('/api/');

    reply.header('Content-Security-Policy', isApi ? API_CSP : WEB_CSP);

    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) return;

    const typedError = error as { statusCode?: number; message?: string };
    const statusCode = typeof typedError.statusCode === 'number' && typedError.statusCode >= 400 && typedError.statusCode < 500
      ? typedError.statusCode
      : 500;
    const isClientError = statusCode < 500;

    request.log.error({
      err: error,
      requestId: request.id,
      statusCode,
    }, isClientError ? 'Request rejected' : 'Unhandled request error');

    reply.code(statusCode).send({
      error: isClientError ? 'REQUEST_FAILED' : 'INTERNAL_SERVER_ERROR',
      message: isClientError ? typedError.message || 'The request could not be completed.' : 'Canvio could not complete the request.',
      requestId: request.id,
    });
  });
}
