import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { boardRoutes } from './routes/boards.js';

dotenv.config();

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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
