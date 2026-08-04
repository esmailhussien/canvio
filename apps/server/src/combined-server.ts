/**
 * Combined HTTP + WebSocket server for production deployment.
 * Merges the Fastify API and the Yjs WebSocket server on a single port
 * so we only need one process (and one free-tier service) in production.
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';
// @ts-ignore
import ywsUtils from 'y-websocket/bin/utils';
import dotenv from 'dotenv';
import { createFilePersistence } from './storage/yPersistence.js';
import { isOriginAllowed } from './security.js';
import { authorizeWebSocketBoard, getBoardIdFromWsRequest } from './wsAccess.js';

dotenv.config();

const { setupWSConnection, setPersistence } = ywsUtils;
setPersistence(createFilePersistence());

const PORT = parseInt(process.env.PORT || '4001', 10);

// ─── HTTP handler (health check + CORS preflight) ─────────────────────
const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-canvio-api-key, x-canvio-client-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Canvio Collaboration Server is running.');
});

// ─── WebSocket handler ────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

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

// ─── Start ────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Canvio Collaboration Server running on port ${PORT}`);
});
