import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { getBoard, listBoards, saveBoard, upsertBoard } from '../storage/boards.js';
import { canAccessBoard, createRateLimitHook, getRequestOwnerId, isRequestAuthorized, readPositiveIntEnv } from '../security.js';

export async function boardRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', createRateLimitHook({
    namespace: 'boards',
    windowMs: readPositiveIntEnv('CANVIO_BOARD_RATE_WINDOW_MS', 60000, 1000, 3_600_000),
    max: readPositiveIntEnv('CANVIO_BOARD_RATE_LIMIT', 120, 1, 10_000),
  }));

  fastify.get('/', async (request) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH' })) {
      return { boards: [] };
    }
    const ownerId = getRequestOwnerId(request);
    const boards = await listBoards();
    return { boards: boards.filter((board) => !board.ownerId || board.ownerId === ownerId) };
  });

  fastify.get('/public', async () => {
    const boards = await listBoards();
    return { boards: boards.filter((board) => Boolean(board.isPublic)) };
  });

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH' })) {
      return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    }
    const id = nanoid(10);
    const now = new Date().toISOString();
    const board = {
      id,
      title: 'New Board',
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

    const { id } = request.params;
    const sourceBoard = await getBoard(id);
    if (!sourceBoard) {
      return reply.code(404).send({ error: 'SOURCE_BOARD_NOT_FOUND' });
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
    return { url: '/w/' + newId, ...forkedBoard };
  });

  fastify.post('/:id/share', async (request: FastifyRequest<{ Params: { id: string }; Body?: { isPublic?: boolean } }>, reply: FastifyReply) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH' })) {
      return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    }

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

    const { id } = request.params;
    const existing = await getBoard(id);
    if (existing) {
      if (!existing.isPublic && !canAccessBoard(existing.ownerId, request, existing.shareToken)) {
        return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
      }
      return saveBoard({ ...existing, updatedAt: new Date().toISOString() });
    }

    return upsertBoard(id, `Board ${id}`, getRequestOwnerId(request));
  });

  fastify.patch('/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { title?: string; isPublic?: boolean; appearance?: { theme?: 'dark' | 'light'; canvasBackground?: string | null } };
  }>, reply: FastifyReply) => {
    if (!isRequestAuthorized(request, { requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH', allowShareToken: true })) {
      return reply.code(401).send({ error: 'AUTH_REQUIRED' });
    }

    const { id } = request.params;
    const existing = await getBoard(id);
    if (existing && !canAccessBoard(existing.ownerId, request, existing.shareToken)) {
      return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
    }
    const board = existing || await upsertBoard(id, `Board ${id}`, getRequestOwnerId(request));
    const title = typeof request.body?.title === 'string' && request.body.title.trim()
      ? request.body.title.trim()
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
