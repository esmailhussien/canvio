import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { boardRoutes } from './routes/boards.js';
import { aiRoutes } from './routes/ai.js';
import { createCorsOriginGuard } from './security.js';
import { FASTIFY_OPTIONS, registerErrorHandler, registerSecurityHeaders } from './http.js';
import { getReadiness } from './health.js';

dotenv.config();

const app = Fastify(FASTIFY_OPTIONS);
registerErrorHandler(app);
registerSecurityHeaders(app);

app.register(cors, {
  origin: createCorsOriginGuard(),
});

app.get('/', async () => {
  return {
    name: 'Canvio API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      boards: '/api/boards',
      ai: '/api/ai',
    },
  };
});

app.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

app.get('/health/ready', async (_request, reply) => {
  try {
    return await getReadiness();
  } catch (error) {
    app.log.error({ err: error }, 'Readiness check failed');
    return reply.code(503).send({ status: 'not_ready', storage: 'unavailable' });
  }
});

app.register(boardRoutes, { prefix: '/api/boards' });
app.register(aiRoutes, { prefix: '/api/ai' });

const PORT = parseInt(process.env.PORT || '4000', 10);

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 API Server running at http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
