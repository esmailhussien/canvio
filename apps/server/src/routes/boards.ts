import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { getBoard, listBoards, saveBoard, upsertBoard } from '../storage/boards.js';
import { canAccessBoard, createAuthHook, createRateLimitHook, getRequestOwnerId } from '../security.js';

export async function boardRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', createRateLimitHook({
    namespace: 'boards',
    windowMs: parseInt(process.env.CANVIO_BOARD_RATE_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.CANVIO_BOARD_RATE_LIMIT || '120', 10),
  }));
  fastify.addHook('onRequest', createAuthHook({ requiredEnv: 'CANVIO_REQUIRE_BOARD_AUTH' }));

  fastify.get('/', async (request) => {
    const ownerId = getRequestOwnerId(request);
    const boards = await listBoards();
    return { boards: boards.filter((board) => !board.ownerId || board.ownerId === ownerId) };
  });

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
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

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const existing = await getBoard(id);
    if (existing) {
      if (!canAccessBoard(existing.ownerId, request)) return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
      return saveBoard({ ...existing, updatedAt: new Date().toISOString() });
    }

    return upsertBoard(id, `Board ${id}`, getRequestOwnerId(request));
  });

  fastify.patch('/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { title?: string; appearance?: { theme?: 'dark' | 'light'; canvasBackground?: string | null } };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const existing = await getBoard(id);
    if (existing && !canAccessBoard(existing.ownerId, request)) {
      return reply.code(403).send({ error: 'BOARD_FORBIDDEN' });
    }
    const board = existing || await upsertBoard(id, `Board ${id}`, getRequestOwnerId(request));
    const title = typeof request.body?.title === 'string' && request.body.title.trim()
      ? request.body.title.trim()
      : board.title;
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
      appearance,
      updatedAt: new Date().toISOString(),
    });
  });
}
