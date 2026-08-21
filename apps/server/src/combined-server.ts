/**
 * Combined HTTP + WebSocket server for production deployment.
 * Merges the Fastify API and the Yjs WebSocket server on a single port
 * so we only need one process (and one free-tier service) in production.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
// @ts-ignore
import ywsUtils from 'y-websocket/bin/utils';
import dotenv from 'dotenv';
import { boardRoutes } from './routes/boards.js';
import { aiRoutes } from './routes/ai.js';
import { createFilePersistence } from './storage/yPersistence.js';
import { createCorsOriginGuard, readPositiveIntEnv } from './security.js';
import { authorizeWebSocketBoard, getBoardIdFromWsRequest } from './wsAccess.js';
import { FASTIFY_OPTIONS, registerErrorHandler, registerSecurityHeaders } from './http.js';
import { getReadiness } from './health.js';

dotenv.config();

const { setupWSConnection, setPersistence } = ywsUtils;
setPersistence(createFilePersistence());

const PORT = parseInt(process.env.PORT || '4001', 10);

const app = Fastify(FASTIFY_OPTIONS);
registerErrorHandler(app);
registerSecurityHeaders(app);

app.register(cors, {
  origin: createCorsOriginGuard(),
  allowedHeaders: ['Content-Type', 'Authorization', 'x-canvio-api-key', 'x-canvio-client-id', 'x-canvio-share-token'],
});

app.get('/', async () => ({
  name: 'Canvio Combined API + Collaboration Server',
  status: 'online',
  version: '1.0.0',
  endpoints: {
    boards: '/api/boards',
    ai: '/api/ai',
    health: '/health',
  },
}));

app.get('/health', async () => ({ status: 'healthy', timestamp: new Date().toISOString() }));

app.get('/health/ready', async (_request, reply) => {
  try {
    return await getReadiness();
  } catch (error) {
    app.log.error({ err: error }, 'Readiness check failed');
    return reply.code(503).send({ status: 'not_ready', storage: 'unavailable' });
  }
});

app.register(boardRoutes, { prefix: '/api/boards' });
app.register(aiRoutes, { prefix: '/api/ai' });

// WebSocket hardening: bound message size and connection counts so a single
// client cannot exhaust memory on a small instance.
const WS_MAX_PAYLOAD = readPositiveIntEnv('CANVIO_WS_MAX_PAYLOAD_KB', 2048, 64, 16_384) * 1024;
const WS_MAX_CONNECTIONS = readPositiveIntEnv('CANVIO_WS_MAX_CONNECTIONS', 200, 10, 10_000);
const WS_MAX_PER_IP = readPositiveIntEnv('CANVIO_WS_MAX_PER_IP', 20, 1, 1_000);

const wss = new WebSocketServer({ server: app.server, maxPayload: WS_MAX_PAYLOAD });

let activeConnections = 0;
const connectionsPerIp = new Map<string, number>();

wss.on('connection', async (conn, req) => {
  if (activeConnections >= WS_MAX_CONNECTIONS) {
    conn.close(1013, 'Server at connection capacity');
    return;
  }

  const peerIp = req.socket.remoteAddress || 'unknown';
  const currentForIp = connectionsPerIp.get(peerIp) || 0;
  if (currentForIp >= WS_MAX_PER_IP) {
    conn.close(1013, 'Too many connections from this address');
    return;
  }

  const boardId = getBoardIdFromWsRequest(req);

  try {
    const access = await authorizeWebSocketBoard(req, boardId);
    if (!access.ok) {
      conn.close(access.code, access.reason);
      return;
    }

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

    console.log(`[WS] Client connected → board: ${boardId}`);
    setupWSConnection(conn, req, { docName: boardId });
  } catch (err) {
    console.error(`[WS] Failed to authorize board ${boardId}`, err);
    conn.close(1011, 'WebSocket authorization failed');
  }
});

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
