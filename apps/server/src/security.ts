import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { FastifyReply, FastifyRequest } from 'fastify';

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

function envList(name: string) {
  return (process.env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function envBool(name: string, fallback = false) {
  const value = (process.env[name] || '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

export { envBool };

function hashValue(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function cleanClientId(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function getBearerTokenFromHeaders(headers: IncomingHttpHeaders, url?: string) {
  const auth = headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const apiKey = headers['x-canvio-api-key'];
  if (typeof apiKey === 'string' && apiKey.trim()) return apiKey.trim();
  return getQueryValue(url, 'token') || getQueryValue(url, 'apiToken') || '';
}

function getShareTokenFromHeaders(headers: IncomingHttpHeaders, url?: string) {
  const headerValue = headers['x-canvio-share-token'];
  if (typeof headerValue === 'string' && headerValue.trim()) return headerValue.trim();
  return getQueryValue(url, 'share') || '';
}

function getConfiguredTokens() {
  return [
    ...envList('CANVIO_API_TOKENS'),
    ...envList('CANVIO_API_TOKEN'),
  ];
}

function getClientIp(request: FastifyRequest) {
  // Fastify owns proxy handling through trustProxy. Never read x-forwarded-for
  // directly here: callers can rotate that header to escape rate limiting.
  return request.ip || 'unknown';
}

export const ALLOWED_CORS_HEADERS = [
  'Content-Type',
  'Authorization',
  'x-canvio-api-key',
  'x-canvio-client-id',
  'x-canvio-share-token',
];

export function createCorsOriginGuard() {
  return async (origin: string | undefined) => {
    return isOriginAllowed(origin);
  };
}

export function isOriginAllowed(origin: string | undefined) {
  const allowedOrigins = new Set([
    'https://canvio.space',
    'https://www.canvio.space',
    ...envList('CANVIO_ALLOWED_ORIGINS'),
  ]);
  const allowLocalDev = envBool('CANVIO_ALLOW_LOCAL_ORIGINS', process.env.NODE_ENV !== 'production');
  if (!origin) return true;
  return allowedOrigins.has(origin) || (allowLocalDev && isLocalOrigin(origin));
}

export function createRateLimitHook(options: {
  namespace: string;
  windowMs: number;
  max: number;
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `${options.namespace}:${getRequestRateLimitKey(request)}`;
    const now = Date.now();

    // Keep this process-local limiter bounded on long-lived Render instances.
    if (rateBuckets.size > 10_000) {
      for (const [bucketKey, bucketValue] of rateBuckets) {
        if (bucketValue.resetAt <= now) rateBuckets.delete(bucketKey);
      }
    }

    if (!rateBuckets.has(key) && rateBuckets.size >= 20_000) {
      const oldestKey = rateBuckets.keys().next().value as string | undefined;
      if (oldestKey) rateBuckets.delete(oldestKey);
    }

    const bucket = rateBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return;
    }

    bucket.count += 1;
    if (bucket.count <= options.max) return;

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return reply
      .header('Retry-After', String(retryAfterSeconds))
      .code(429)
      .send({ error: 'RATE_LIMITED', retryAfterSeconds });
  };
}

// Identity-independent backstop: even if per-identity keys are spoofed, this
// caps total abuse per process within each window.
export function createGlobalRateLimitHook(options: {
  namespace: string;
  windowMs: number;
  max: number;
}) {
  return createRateLimitHook(options);
}

export function readPositiveIntEnv(name: string, fallback: number, min = 1, max = 1_000_000) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function createAuthHook(options: { requiredEnv?: string } = {}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (isRequestAuthorized(request, { requiredEnv: options.requiredEnv })) return;

    reply.code(401).send({ error: 'AUTH_REQUIRED' });
  };
}

export function isRequestAuthorized(
  request: FastifyRequest,
  options: { requiredEnv?: string; allowShareToken?: boolean } = {}
) {
  if (!isAuthRequired(options.requiredEnv)) return true;
  if (isValidApiToken(request.headers, request.url)) return true;
  return Boolean(options.allowShareToken && getRequestShareToken(request));
}

export function getRequestOwnerId(request: FastifyRequest) {
  return getOwnerIdFromHeaders(request.headers, request.ip || 'unknown', request.url);
}

// Rate-limit identity must never be client-chosen. A caller can rotate
// x-canvio-client-id or x-forwarded-for freely, so the limiter only keys on a
// configured bearer token or the proxy-resolved connection IP.
export function getRequestRateLimitKey(request: FastifyRequest) {
  const token = getBearerTokenFromHeaders(request.headers, request.url);
  if (token && isConfiguredToken(token)) return `auth:${hashValue(token)}`;
  return `ip:${getClientIp(request)}`;
}

export function getOwnerIdFromHeaders(headers: IncomingHttpHeaders, ipFallback = 'unknown', url?: string) {
  const token = getBearerTokenFromHeaders(headers, url);
  if (token && isConfiguredToken(token)) return `auth:${hashValue(token)}`;

  const clientId = cleanClientId(headers['x-canvio-client-id']) || cleanClientId(getQueryValue(url, 'clientId'));
  if (clientId) return `anon:${clientId}`;

  return `anon:${hashValue(`${ipFallback}:${headers['user-agent'] || ''}`)}`;
}

export function getRequestShareToken(request: FastifyRequest) {
  return getShareTokenFromHeaders(request.headers, request.url);
}

export function getShareTokenFromRequestHeaders(headers: IncomingHttpHeaders, url?: string) {
  return getShareTokenFromHeaders(headers, url);
}

export function canAccessBoard(boardOwnerId: string | undefined, request: FastifyRequest, boardShareToken?: string) {
  return canOwnerAccessBoard(boardOwnerId, getRequestOwnerId(request), boardShareToken, getRequestShareToken(request));
}

export function canOwnerAccessBoard(
  boardOwnerId: string | undefined,
  ownerId: string,
  boardShareToken?: string,
  requestShareToken?: string
) {
  if (!boardOwnerId) return true;
  if (boardOwnerId === ownerId) return true;
  return Boolean(
    boardShareToken &&
    requestShareToken &&
    safeEqual(boardShareToken, requestShareToken)
  );
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isAuthRequired(requiredEnv?: string) {
  const tokens = getConfiguredTokens();
  const envRequired = requiredEnv ? envBool(requiredEnv, false) : false;
  return tokens.length > 0 || envBool('CANVIO_REQUIRE_AUTH', false) || envRequired;
}

export function isValidSocketAuth(headers: IncomingHttpHeaders, url?: string) {
  if (!isAuthRequired('CANVIO_REQUIRE_WS_AUTH')) return true;
  if (getShareTokenFromHeaders(headers, url)) return true;
  return isValidApiToken(headers, url);
}

function isValidApiToken(headers: IncomingHttpHeaders, url?: string) {
  const token = getBearerTokenFromHeaders(headers, url);
  return Boolean(token && isConfiguredToken(token));
}

function isConfiguredToken(token: string) {
  const tokens = getConfiguredTokens();
  if (tokens.length === 0) return false;
  const provided = Buffer.from(token);
  return tokens.some((candidate) => {
    const expected = Buffer.from(candidate);
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(expected, provided);
  });
}

function isLocalOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return false;
  }
}

function getQueryValue(url: string | undefined, key: string) {
  if (!url) return '';
  try {
    return new URL(url, 'http://canvio.local').searchParams.get(key) || '';
  } catch {
    return '';
  }
}
