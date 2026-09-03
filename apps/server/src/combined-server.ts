/**
 * Combined HTTP + WebSocket server for production deployment.
 * Merges the Fastify API, static frontend serving, and Yjs WebSocket server
 * on a single port for self-contained single-node production deployment.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
// @ts-ignore
import ywsUtils from 'y-websocket/bin/utils';
import dotenv from 'dotenv';
import { boardRoutes } from './routes/boards.js';
import { aiRoutes } from './routes/ai.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { createFilePersistence } from './storage/yPersistence.js';
import { ALLOWED_CORS_HEADERS, createCorsOriginGuard, readPositiveIntEnv } from './security.js';
import { authorizeWebSocketBoard, getBoardIdFromWsRequest } from './wsAccess.js';
import { FASTIFY_OPTIONS, registerErrorHandler, registerSecurityHeaders } from './http.js';
import { registerHealthRoutes } from './health.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DIST_DIR = path.resolve(__dirname, '../../web/dist');
const DIST_DIR = process.env.CANVIO_STATIC_DIR || DEFAULT_DIST_DIR;

const { setupWSConnection, setPersistence } = ywsUtils;
const persistence = createFilePersistence();
setPersistence(persistence);

const PORT = parseInt(process.env.PORT || '4000', 10);

const app = Fastify(FASTIFY_OPTIONS);
registerErrorHandler(app);
registerSecurityHeaders(app);

// Global process-level safety traps to satisfy R4 zero unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  app.log.error({ err: reason, promise }, 'Unhandled Promise Rejection caught at process level');
});

process.on('uncaughtException', (error) => {
  app.log.fatal({ err: error }, 'Uncaught Exception caught at process level. Forcing exit.');
  process.exit(1);
});

app.register(cors, {
  origin: createCorsOriginGuard(),
  allowedHeaders: ALLOWED_CORS_HEADERS,
});

// Dynamic runtime configuration route for zero-config client port binding
app.get('/canvio-config.js', async (_request, reply) => {
  reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  reply.header('Pragma', 'no-cache');
  reply.header('Expires', '0');
  reply.type('application/javascript; charset=utf-8');

  const configuredApiUrl = process.env.VITE_API_URL || process.env.CANVIO_API_URL || '';
  const configuredWsUrl = process.env.VITE_WS_URL || process.env.CANVIO_WS_URL || '';

  return [
    'window.CANVIO_CONFIG = {',
    `  apiUrl: ${JSON.stringify(configuredApiUrl)},`,
    `  wsUrl: ${JSON.stringify(configuredWsUrl)} || ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host),`,
    '};',
    '',
  ].join('\n');
});

// Register static frontend serving if compiled web dist exists
if (fs.existsSync(DIST_DIR)) {
  app.register(fastifyStatic, {
    root: DIST_DIR,
    prefix: '/',
    decorateReply: true,
    serve: true,
    wildcard: true,
  });
} else {
  app.log.warn(`Static frontend directory not found at ${DIST_DIR}. Static serving disabled.`);
}

// API Metadata endpoint relocated from '/' to '/api' to allow '/' to serve frontend
app.get('/api', async () => ({
  name: 'Canvio Combined API + Collaboration Server',
  status: 'online',
  version: '1.0.0',
  endpoints: {
    boards: '/api/boards',
    ai: '/api/ai',
    telemetry: '/api/telemetry/events',
    health: '/health',
    apiHealth: '/api/health',
  },
}));

app.register(boardRoutes, { prefix: '/api/boards' });
app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/boards/:id', async (request, reply) => {
  const { id } = request.params;
  const body = request.body || {};
  const now = new Date().toISOString();
  const { saveBoard } = await import('./storage/boards.js');
  const board = {
    id,
    title: (typeof body.title === 'string' ? body.title : typeof body.name === 'string' ? body.name : `Board ${id}`),
    ...body,
    createdAt: (typeof body.createdAt === 'string' ? body.createdAt : now),
    updatedAt: now,
  };
  await saveBoard(board as any);
  return reply.code(200).send({ url: `/w/${id}`, ...board });
});
app.register(aiRoutes, { prefix: '/api/ai' });
app.register(telemetryRoutes, { prefix: '/api/telemetry' });

// Comprehensive 404, SSG prerender route, and SPA fallback handler
app.setNotFoundHandler(async (request, reply) => {
  const pathname = (request.url || '').split('?')[0];

  // 1. Always preserve 404 JSON for API routes
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return reply.code(404).send({
      error: 'NOT_FOUND',
      message: `API route not found: ${request.method} ${pathname}`,
      statusCode: 404,
    });
  }

  // 2. Only GET and HEAD requests should attempt HTML / SPA resolution
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return reply.code(404).send({
      error: 'NOT_FOUND',
      message: `Cannot ${request.method} ${pathname}`,
      statusCode: 404,
    });
  }

  // 3. Unmatched static asset requests return 404 JSON instead of HTML fallback
  const isAsset = pathname.startsWith('/assets/') || /\.[a-zA-Z0-9]+$/.test(pathname);
  if (isAsset) {
    return reply.code(404).send({
      error: 'NOT_FOUND',
      message: `Asset not found: ${pathname}`,
      statusCode: 404,
    });
  }

  // 4. SSG & SPA fallback resolution
  if (fs.existsSync(DIST_DIR)) {
    const cleanPath = path
      .normalize(pathname)
      .replace(/^(\.\.[\/\\])+/, '')
      .replace(/^[/\\]+|[/\\]+$/g, '');

    if (cleanPath) {
      const posixPath = cleanPath.split(path.sep).join('/');
      const ssgRelativePath = `${posixPath}/index.html`;
      const ssgCandidatePath = path.join(DIST_DIR, ssgRelativePath);

      if (fs.existsSync(ssgCandidatePath) && fs.statSync(ssgCandidatePath).isFile()) {
        return reply.type('text/html; charset=utf-8').sendFile(ssgRelativePath);
      }
    }

    const spaIndexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(spaIndexPath) && fs.statSync(spaIndexPath).isFile()) {
      return reply.type('text/html; charset=utf-8').sendFile('index.html');
    }
  }

  return reply.code(404).send({
    error: 'NOT_FOUND',
    message: `Route not found: ${request.method} ${pathname}`,
    statusCode: 404,
  });
});

// WebSocket hardening: bound message size and connection counts so a single
// client cannot exhaust memory on a small instance.
const WS_MAX_PAYLOAD = readPositiveIntEnv('CANVIO_WS_MAX_PAYLOAD_KB', 2048, 64, 16_384) * 1024;
const WS_MAX_CONNECTIONS = readPositiveIntEnv('CANVIO_WS_MAX_CONNECTIONS', 200, 1, 10_000);
const WS_MAX_PER_IP = readPositiveIntEnv('CANVIO_WS_MAX_PER_IP', 100, 1, 1_000);

const wss = new WebSocketServer({ server: app.server, maxPayload: WS_MAX_PAYLOAD });

let activeConnections = 0;
const connectionsPerIp = new Map<string, number>();

registerHealthRoutes(app, {
  getActiveConnections: () => activeConnections,
  getActiveDocs: () => persistence.getActiveDocs(),
  getMaxConnections: () => WS_MAX_CONNECTIONS,
});

wss.on('connection', async (conn, req) => {
  // Buffer early incoming frames so initial client sync step is never dropped during async auth
  const earlyMessages: Array<{ data: any; isBinary: boolean }> = [];
  const earlyListener = (data: any, isBinary: boolean) => {
    earlyMessages.push({ data, isBinary });
  };
  conn.on('message', earlyListener);

  const forwardedFor = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : null;
  const peerIp = forwardedFor || req.socket.remoteAddress || 'unknown';
  const currentForIp = connectionsPerIp.get(peerIp) || 0;

  if (activeConnections >= WS_MAX_CONNECTIONS) {
    conn.off('message', earlyListener);
    conn.close(1013, 'Server at connection capacity');
    return;
  }

  if (currentForIp >= WS_MAX_PER_IP) {
    conn.off('message', earlyListener);
    conn.close(1013, 'Too many connections from this address');
    return;
  }

  // Reserve connection slot immediately so concurrent handshakes count against limits
  activeConnections += 1;
  connectionsPerIp.set(peerIp, currentForIp + 1);

  let released = false;
  const releaseConnection = () => {
    if (released) return;
    released = true;
    activeConnections -= 1;
    const remaining = (connectionsPerIp.get(peerIp) || 1) - 1;
    if (remaining <= 0) connectionsPerIp.delete(peerIp);
    else connectionsPerIp.set(peerIp, remaining);
  };
  conn.on('close', releaseConnection);
  conn.on('error', releaseConnection);

  const boardId = getBoardIdFromWsRequest(req);

  try {
    const access = await authorizeWebSocketBoard(req, boardId);
    if (!access.ok) {
      releaseConnection();
      conn.off('message', earlyListener);
      conn.close(access.code, access.reason);
      return;
    }

    setupWSConnection(conn, req, { docName: boardId });
    conn.off('message', earlyListener);
    for (const msg of earlyMessages) {
      conn.emit('message', msg.data, msg.isBinary);
    }
  } catch (err) {
    releaseConnection();
    conn.off('message', earlyListener);
    console.error(`[WS] Failed to authorize board ${boardId}`, err);
    conn.close(1011, 'WebSocket authorization failed');
  }
});

let isShuttingDown = false;

async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    app.log.warn({ signal }, 'Shutdown already in progress; ignoring duplicate signal');
    return;
  }
  isShuttingDown = true;
  app.log.info({ signal }, `Received ${signal}. Initiating graceful shutdown...`);

  // 10-second fallback guard: force termination if components hang
  const forceExitTimer = setTimeout(() => {
    app.log.error('Graceful shutdown timed out after 10000ms. Forcing process exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    // Step 1: Stop accepting new WebSocket connections
    app.log.info('Closing WebSocket server listener...');
    wss.close((err) => {
      if (err) app.log.warn({ err }, 'Error during WebSocket server close');
    });

    // Step 2: Notify and disconnect all open WebSocket clients with code 1001 (Going Away)
    app.log.info(`Disconnecting ${wss.clients.size} active WebSocket clients with code 1001...`);
    for (const client of wss.clients) {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        try {
          client.close(1001, 'Server shutting down');
        } catch (err) {
          app.log.warn({ err }, 'Error closing client WebSocket');
        }
      } else if (client.readyState === 0 /* WebSocket.CONNECTING */) {
        try {
          client.terminate();
        } catch (err) {
          app.log.warn({ err }, 'Error terminating connecting WebSocket');
        }
      }
    }

    // Step 3: Flush all pending debounced writes and active Yjs documents to disk
    app.log.info('Flushing all Yjs documents to persistence...');
    await persistence.flushAll();
    app.log.info('All Yjs documents flushed to disk successfully.');

    // Step 4: Close Fastify HTTP server and drain pending requests
    app.log.info('Closing Fastify HTTP server...');
    await app.close();
    app.log.info('Fastify HTTP server closed.');

    clearTimeout(forceExitTimer);
    app.log.info('Graceful shutdown completed cleanly. Exiting.');
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    app.log.fatal({ err: error }, 'Error occurred during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Canvio Combined API + Collaboration Server running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
