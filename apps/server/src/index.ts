import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { boardRoutes } from './routes/boards.js';
import { aiRoutes } from './routes/ai.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { ALLOWED_CORS_HEADERS, createCorsOriginGuard } from './security.js';
import { FASTIFY_OPTIONS, registerErrorHandler, registerSecurityHeaders } from './http.js';
import { registerHealthRoutes } from './health.js';

dotenv.config();

const app = Fastify(FASTIFY_OPTIONS);
registerErrorHandler(app);
registerSecurityHeaders(app);

app.register(cors, {
  origin: createCorsOriginGuard(),
  allowedHeaders: ALLOWED_CORS_HEADERS,
});

app.get('/', async () => {
  return {
    name: 'Canvio API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      boards: '/api/boards',
      ai: '/api/ai',
      telemetry: '/api/telemetry/events',
      health: '/health',
      apiHealth: '/api/health',
    },
  };
});

registerHealthRoutes(app);

app.register(boardRoutes, { prefix: '/api/boards' });
app.register(aiRoutes, { prefix: '/api/ai' });
app.register(telemetryRoutes, { prefix: '/api/telemetry' });

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
