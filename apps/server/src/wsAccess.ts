import type { IncomingMessage } from 'node:http';
import { canOwnerAccessBoard, getOwnerIdFromHeaders, getShareTokenFromRequestHeaders, isOriginAllowed, isValidSocketAuth } from './security.js';
import { getBoard, saveBoard, upsertBoard } from './storage/boards.js';

export function getBoardIdFromWsRequest(req: IncomingMessage) {
  try {
    const url = new URL(req.url || '/', 'http://canvio.local');
    return decodeURIComponent(url.pathname.slice(1)) || 'default-board';
  } catch {
    const rawPath = (req.url || '/').slice(1).split('?')[0];
    return rawPath ? decodeURIComponent(rawPath) : 'default-board';
  }
}

export async function authorizeWebSocketBoard(req: IncomingMessage, boardId: string) {
  const origin = req.headers.origin;
  if (!isOriginAllowed(origin)) {
    return { ok: false as const, code: 1008, reason: 'Origin not allowed' };
  }

  if (!isValidSocketAuth(req.headers, req.url)) {
    return { ok: false as const, code: 1008, reason: 'Authentication required' };
  }

  const ownerId = getOwnerIdFromHeaders(req.headers, req.socket.remoteAddress || 'unknown', req.url);
  const shareToken = getShareTokenFromRequestHeaders(req.headers, req.url);
  const existing = await getBoard(boardId);

  if (existing) {
    if (!canOwnerAccessBoard(existing.ownerId, ownerId, existing.shareToken, shareToken)) {
      return { ok: false as const, code: 1008, reason: 'Board access denied' };
    }
    await saveBoard({ ...existing, updatedAt: new Date().toISOString() });
    return { ok: true as const, ownerId };
  }

  await upsertBoard(boardId, `Board ${boardId}`, ownerId);
  return { ok: true as const, ownerId };
}
