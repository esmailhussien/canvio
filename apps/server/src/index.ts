import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { boardRoutes } from './routes/boards.js';

dotenv.config();

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: true,
});

app.get('/', async () => {
  return {
    name: 'Canvio API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      boards: '/api/boards',
    },
  };
});

app.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

app.register(boardRoutes, { prefix: '/api/boards' });

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
