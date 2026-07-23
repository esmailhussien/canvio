import { WebSocketServer } from 'ws';
// @ts-ignore
import ywsUtils from 'y-websocket/bin/utils';
import dotenv from 'dotenv';
import http from 'http';
import { createFilePersistence } from './storage/yPersistence.js';
import { upsertBoard } from './storage/boards.js';

const { setupWSConnection, setPersistence } = ywsUtils;

dotenv.config();
setPersistence(createFilePersistence());

const PORT = parseInt(process.env.WS_PORT || '4001', 10);

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Yjs WebSocket Server is running.');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (conn, req) => {
  // Extract board ID from URL, e.g. /boardId
  const url = req.url || '/';
  const boardId = url.slice(1).split('?')[0] || 'default-board';
  
  console.log(`Client connected to board: ${boardId}`);
  upsertBoard(boardId).catch((error) => {
    console.error(`Failed to touch board metadata for ${boardId}`, error);
  });
  
  // Use y-websocket utility to handle the connection
  setupWSConnection(conn, req, { docName: boardId });
});

server.listen(PORT, () => {
  console.log(`🚀 Yjs WebSocket Server running at ws://localhost:${PORT}`);
});
