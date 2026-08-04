import { WebSocketServer } from 'ws';
// @ts-ignore
import ywsUtils from 'y-websocket/bin/utils';
import dotenv from 'dotenv';
import http from 'http';
import { createFilePersistence } from './storage/yPersistence.js';
import { authorizeWebSocketBoard, getBoardIdFromWsRequest } from './wsAccess.js';

const { setupWSConnection, setPersistence } = ywsUtils;

dotenv.config();
setPersistence(createFilePersistence());

const PORT = parseInt(process.env.WS_PORT || '4001', 10);

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Yjs WebSocket Server is running.');
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (conn, req) => {
  const boardId = getBoardIdFromWsRequest(req);

  try {
    const access = await authorizeWebSocketBoard(req, boardId);
    if (!access.ok) {
      conn.close(access.code, access.reason);
      return;
    }

    console.log(`Client connected to board: ${boardId}`);
    setupWSConnection(conn, req, { docName: boardId });
  } catch (error) {
    console.error(`Failed to authorize WebSocket board ${boardId}`, error);
    conn.close(1011, 'WebSocket authorization failed');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Yjs WebSocket Server running at ws://0.0.0.0:${PORT}`);
});
