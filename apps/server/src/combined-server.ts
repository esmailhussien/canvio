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
import { upsertBoard } from './storage/boards.js';

dotenv.config();

const { setupWSConnection, setPersistence } = ywsUtils;
setPersistence(createFilePersistence());

const PORT = parseInt(process.env.PORT || '4001', 10);

// ─── HTTP handler (health check + CORS preflight) ─────────────────────
const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

wss.on('connection', (conn, req) => {
  const url = req.url || '/';
  const boardId = url.slice(1).split('?')[0] || 'default-board';

  console.log(`[WS] Client connected → board: ${boardId}`);
  upsertBoard(boardId).catch((err) => {
    console.error(`[WS] Failed to touch board metadata for ${boardId}`, err);
  });

  setupWSConnection(conn, req, { docName: boardId });
});

// ─── Start ────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Canvio Collaboration Server running on port ${PORT}`);
});
