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
import { createCorsOriginGuard } from './security.js';
import { authorizeWebSocketBoard, getBoardIdFromWsRequest } from './wsAccess.js';

dotenv.config();

const { setupWSConnection, setPersistence } = ywsUtils;
setPersistence(createFilePersistence());

const PORT = parseInt(process.env.PORT || '4001', 10);

const app = Fastify({
  logger: true,
});

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

app.register(boardRoutes, { prefix: '/api/boards' });
app.register(aiRoutes, { prefix: '/api/ai' });

const wss = new WebSocketServer({ server: app.server });

wss.on('connection', async (conn, req) => {
  const boardId = getBoardIdFromWsRequest(req);

  try {
    const access = await authorizeWebSocketBoard(req, boardId);
    if (!access.ok) {
      conn.close(access.code, access.reason);
      return;
    }

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
