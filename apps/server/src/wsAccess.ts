import type { IncomingMessage } from 'node:http';
import { canOwnerAccessBoard, envBool, getOwnerIdFromHeaders, getShareTokenFromRequestHeaders, isOriginAllowed, isValidSocketAuth } from './security.js';
import { getBoard, saveBoard, upsertBoard } from './storage/boards.js';
import { isSafeBoardId } from './storage/paths.js';

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
  // Browsers always send an Origin header. Absent origin means a scripted
  // client; allow it only when explicitly opted in.
  if (!req.headers.origin && !envBool('CANVIO_ALLOW_NO_ORIGIN_WS', false)) {
    return { ok: false as const, code: 1008, reason: 'Origin required' };
  }

  if (!isOriginAllowed(req.headers.origin)) {
    return { ok: false as const, code: 1008, reason: 'Origin not allowed' };
  }

  if (!isValidSocketAuth(req.headers, req.url)) {
    return { ok: false as const, code: 1008, reason: 'Authentication required' };
  }

  // Reject identifiers that only survive sanitization by mutation — those
  // would alias another board's file on disk.
  if (!isSafeBoardId(boardId)) {
    return { ok: false as const, code: 1008, reason: 'Invalid board id' };
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
