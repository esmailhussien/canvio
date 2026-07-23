import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { listBoards, saveBoard, upsertBoard } from '../storage/boards.js';

export async function boardRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return { boards: await listBoards() };
  });

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = nanoid(10);
    const now = new Date().toISOString();
    const board = {
      id,
      title: 'New Board',
      createdAt: now,
      updatedAt: now,
    };
    await saveBoard(board);
    return { url: '/w/' + id, ...board };
  });

  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    return upsertBoard(id);
  });

  fastify.patch('/:id', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { title?: string; appearance?: { theme?: 'dark' | 'light'; canvasBackground?: string | null } };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const existing = await upsertBoard(id);
    const title = typeof request.body?.title === 'string' && request.body.title.trim()
      ? request.body.title.trim()
      : existing.title;
    const appearance = request.body?.appearance
      ? {
          theme: request.body.appearance.theme === 'light' ? 'light' as const : request.body.appearance.theme === 'dark' ? 'dark' as const : existing.appearance?.theme,
          canvasBackground: typeof request.body.appearance.canvasBackground === 'string' || request.body.appearance.canvasBackground === null
            ? request.body.appearance.canvasBackground
            : existing.appearance?.canvasBackground,
        }
      : existing.appearance;

    return saveBoard({
      ...existing,
      title,
      appearance,
      updatedAt: new Date().toISOString(),
    });
  });
}
