import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { getBoard, listBoards, saveBoard, upsertBoard } from '../storage/boards.js';
import { isSafeBoardId } from '../storage/paths.js';
import { copyYDoc } from '../storage/yPersistence.js';
import { canAccessBoard, createRateLimitHook, getRequestOwnerId, isRequestAuthorized, readPositiveIntEnv } from '../security.js';

export async function boardRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', createRateLimitHook({
    namespace: 'boards',
    windowMs: readPositiveIntEnv('CANVIO_BOARD_RATE_WINDOW_MS', 60000, 1000, 3_600_000),
    max: readPositiveIntEnv('CANVIO_BOARD_RATE_LIMIT', 120, 1, 10_000),
  }));

  const rejectUnsafeId = (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isSafeBoardId(request.params.id)) {
      return reply.code(400).send({ error: 'INVALID_BOARD_ID' });
    }
    return undefined;
  };

  fastify.get('/', async (request) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH' })) {
      return { boards: [] };
    }
    const ownerId = getRequestOwnerId(request);
    if (!ownerId) {
      return { boards: [] };
    }
    const boards = await listBoards();
    return { boards: boards.filter((board) => board.ownerId === ownerId) };
  });

  fastify.get('/public', async () => {
    const boards = await listBoards();
    return {
      boards: boards
        .filter((board) => Boolean(board.isPublic))
        .map(({ shareToken: _shareToken, ...rest }) => rest),
    };
  });

  fastify.post('/', async (request: FastifyRequest<{ Body?: { id?: string; title?: string } }>, reply: FastifyReply) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH' })) {
      return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    }
    const requestedId = request.body?.id;
    if (requestedId && !isSafeBoardId(requestedId)) {
      return reply.code(400).send({ error: 'INVALID_BOARD_ID' });
    }
    const id = requestedId || nanoid(10);
    const existing = await getBoard(id);
    if (existing) {
      if (!canAccessBoard(existing.ownerId, request, existing.shareToken)) {
        return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
      }
      return { url: '/w/' + id, ...existing };
    }
    const now = new Date().toISOString();
    const board = {
      id,
      title: (typeof request.body?.title === 'string' && request.body.title.trim().slice(0, 200)) || 'New Board',
      ownerId: getRequestOwnerId(request),
      createdAt: now,
      updatedAt: now,
    };
    await saveBoard(board);
    return { url: '/w/' + id, ...board };
  });

  fastify.post('/:id/fork', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH', allowShareToken: true })) {
      return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    }

    const invalidId = rejectUnsafeId(request, reply);
    if (invalidId) return invalidId;

    const { id } = request.params;
    const sourceBoard = await getBoard(id);
    if (!sourceBoard) {
      return reply.code(404).send({ error: 'SOURCE_BOARD_NOT_FOUND' });
    }

    // Forking is a read of the source board: private boards require ownership
    // or a valid share token, otherwise anyone could exfiltrate metadata.
    if (!sourceBoard.isPublic && !canAccessBoard(sourceBoard.ownerId, request, sourceBoard.shareToken)) {
      return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
    }

    // Increment source fork count
    await saveBoard({
      ...sourceBoard,
      forkCount: (sourceBoard.forkCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    });

    const newId = nanoid(10);
    const now = new Date().toISOString();
    const forkedBoard = {
      id: newId,
      title: `Remix: ${sourceBoard.title}`,
      ownerId: getRequestOwnerId(request),
      forkedFromId: sourceBoard.id,
      forkedFromTitle: sourceBoard.title,
      appearance: sourceBoard.appearance,
      createdAt: now,
      updatedAt: now,
    };
    await saveBoard(forkedBoard);

    // Copy the Yjs canvas document so the fork preserves all nodes, relations,
    // drawings, and other canvas content from the source board.
    try {
      await copyYDoc(sourceBoard.id, newId);
    } catch (err) {
      // Non-fatal: the fork metadata was saved successfully.  The canvas will
      // simply start empty if the Yjs binary is missing (e.g. the source board
      // was never persisted to disk yet).
      fastify.log.warn({ err, sourceId: sourceBoard.id, newId }, 'Failed to copy Yjs document during fork');
    }

    return { url: '/w/' + newId, ...forkedBoard };
  });

  fastify.post('/:id/share', async (request: FastifyRequest<{ Params: { id: string }; Body?: { isPublic?: boolean } }>, reply: FastifyReply) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH' })) {
      return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    }

    const invalidId = rejectUnsafeId(request, reply);
    if (invalidId) return invalidId;

    const { id } = request.params;
    const existing = await getBoard(id);
    const board = existing || await upsertBoard(id, `Board ${id}`, getRequestOwnerId(request));
    if (board.ownerId && board.ownerId !== getRequestOwnerId(request)) {
      return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
    }

    const shareToken = board.shareToken || nanoid(32);
    const isPublic = request.body?.isPublic !== undefined ? Boolean(request.body.isPublic) : board.isPublic;
    await saveBoard({
      ...board,
      shareToken,
      isPublic,
      shareCreatedAt: board.shareCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      url: `/w/${encodeURIComponent(id)}?share=${encodeURIComponent(shareToken)}`,
      shareToken,
      isPublic,
    };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH', allowShareToken: true })) {
      return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    }

    const invalidId = rejectUnsafeId(request, reply);
    if (invalidId) return invalidId;

    const { id } = request.params;
    const existing = await getBoard(id);
    if (!existing) {
      return reply.code(404).send({ error: 'BOARD_NOT_FOUND' });
    }
    if (!existing.isPublic && !canAccessBoard(existing.ownerId, request, existing.shareToken)) {
      return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
    }

    // Only return the shareToken to the board owner; non-owner collaborators
    // and public viewers do not receive administrative tokens.
    const isOwner = Boolean(existing.ownerId && existing.ownerId === getRequestOwnerId(request));
    if (!isOwner && existing.shareToken) {
      const { shareToken: _token, ...sanitized } = existing;
      return sanitized;
    }
    return existing;
  });

  fastify.patch('/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { title?: string; isPublic?: boolean; appearance?: { theme?: 'dark' | 'light'; canvasBackground?: string | null } };
  }>, reply: FastifyReply) => {
    // Share tokens allow canvas collaboration, not board administration.
    // Only API key holders or authenticated owners can modify board properties.
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH' })) {
      return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    }

    const invalidId = rejectUnsafeId(request, reply);
    if (invalidId) return invalidId;

    const { id } = request.params;
    const existing = await getBoard(id);
    const ownerId = getRequestOwnerId(request);

    // If the board already exists and has an owner, only that owner can modify it.
    if (existing && existing.ownerId && existing.ownerId !== ownerId) {
      return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
    }

    const board = existing || await upsertBoard(id, `Board ${id}`, ownerId);
    const title = typeof request.body?.title === 'string' && request.body.title.trim()
      ? request.body.title.trim().slice(0, 200)
      : board.title;
    const isPublic = typeof request.body?.isPublic === 'boolean'
      ? request.body.isPublic
      : board.isPublic;
    const appearance = request.body?.appearance
      ? {
          theme: request.body.appearance.theme === 'light' ? 'light' as const : request.body.appearance.theme === 'dark' ? 'dark' as const : board.appearance?.theme,
          canvasBackground: typeof request.body.appearance.canvasBackground === 'string' || request.body.appearance.canvasBackground === null
            ? request.body.appearance.canvasBackground
            : board.appearance?.canvasBackground,
        }
      : board.appearance;

    return saveBoard({
      ...board,
      title,
      isPublic,
      appearance,
      updatedAt: new Date().toISOString(),
    });
  });
}
