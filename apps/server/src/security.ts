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

function getConfiguredTokens() {
  return [
    ...envList('CANVIO_API_TOKENS'),
    ...envList('CANVIO_API_TOKEN'),
  ];
}

function getClientIpFromHeaders(headers: IncomingHttpHeaders, fallback = 'unknown') {
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return fallback;
}

function getClientIp(request: FastifyRequest) {
  return getClientIpFromHeaders(request.headers, request.ip || 'unknown');
}

export function createCorsOriginGuard() {
  return async (origin: string | undefined) => {
    if (isOriginAllowed(origin)) return true;
    throw new Error('Origin is not allowed by CANVIO_ALLOWED_ORIGINS');
  };
}

export function isOriginAllowed(origin: string | undefined) {
  const allowedOrigins = new Set(envList('CANVIO_ALLOWED_ORIGINS'));
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
    const ownerId = getRequestOwnerId(request);
    const key = `${options.namespace}:${ownerId || getClientIp(request)}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return;
    }

    bucket.count += 1;
    if (bucket.count <= options.max) return;

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    reply
      .header('Retry-After', String(retryAfterSeconds))
      .code(429)
      .send({ error: 'RATE_LIMITED', retryAfterSeconds });
  };
}

export function createAuthHook(options: { requiredEnv?: string } = {}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAuthRequired(options.requiredEnv)) return;
    if (isValidApiToken(request.headers, request.url)) return;

    reply.code(401).send({ error: 'AUTH_REQUIRED' });
  };
}

export function getRequestOwnerId(request: FastifyRequest) {
  return getOwnerIdFromHeaders(request.headers, request.ip || 'unknown', request.url);
}

export function getOwnerIdFromHeaders(headers: IncomingHttpHeaders, ipFallback = 'unknown', url?: string) {
  const token = getBearerTokenFromHeaders(headers, url);
  if (token && isConfiguredToken(token)) return `auth:${hashValue(token)}`;

  const clientId = cleanClientId(headers['x-canvio-client-id']) || cleanClientId(getQueryValue(url, 'clientId'));
  if (clientId) return `anon:${clientId}`;

  return `anon:${hashValue(`${getClientIpFromHeaders(headers, ipFallback)}:${headers['user-agent'] || ''}`)}`;
}

export function canAccessBoard(boardOwnerId: string | undefined, request: FastifyRequest) {
  return canOwnerAccessBoard(boardOwnerId, getRequestOwnerId(request));
}

export function canOwnerAccessBoard(boardOwnerId: string | undefined, ownerId: string) {
  if (!boardOwnerId) return true;
  return boardOwnerId === ownerId;
}

export function isAuthRequired(requiredEnv?: string) {
  const tokens = getConfiguredTokens();
  const envRequired = requiredEnv ? envBool(requiredEnv, false) : false;
  return tokens.length > 0 || envBool('CANVIO_REQUIRE_AUTH', false) || envRequired;
}

export function isValidSocketAuth(headers: IncomingHttpHeaders, url?: string) {
  if (!isAuthRequired('CANVIO_REQUIRE_WS_AUTH')) return true;
  return isValidApiToken(headers, url);
}

function isValidApiToken(headers: IncomingHttpHeaders, url?: string) {
  const token = getBearerTokenFromHeaders(headers, url);
  return Boolean(token && isConfiguredToken(token));
}

function isConfiguredToken(token: string) {
  const tokens = getConfiguredTokens();
  return tokens.length > 0 && tokens.includes(token);
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
