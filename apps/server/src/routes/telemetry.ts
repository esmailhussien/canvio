import type { FastifyInstance, FastifyRequest } from 'fastify';
import { validateProductEventEnvelope } from '@canvio/core';
import { createRateLimitHook, readPositiveIntEnv } from '../security.js';

function telemetryEnabled() {
  return process.env.CANVIO_TELEMETRY_ENABLED !== 'false';
}

export async function telemetryRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', createRateLimitHook({
    namespace: 'telemetry',
    windowMs: readPositiveIntEnv('CANVIO_TELEMETRY_RATE_WINDOW_MS', 60_000, 1_000, 3_600_000),
    max: readPositiveIntEnv('CANVIO_TELEMETRY_RATE_LIMIT', 60, 1, 1_000),
  }));

  fastify.post('/events', async (request: FastifyRequest, reply) => {
    if (!telemetryEnabled()) return reply.code(202).send({ accepted: false });

    const parsed = validateProductEventEnvelope(request.body);
    if (!parsed.ok) {
      request.log.warn({ reason: parsed.reason }, 'Rejected invalid product event');
      return reply.code(400).send({ error: 'INVALID_PRODUCT_EVENT' });
    }

    const event = parsed.value;
    request.log.info({
      productEvent: {
        schemaVersion: event.schemaVersion,
        eventId: event.eventId,
        sessionId: event.sessionId,
        boardTraceId: event.boardTraceId,
        name: event.name,
        occurredAt: event.occurredAt,
        context: event.context,
        properties: event.properties,
      },
    }, 'Product event');

    return reply.code(202).send({ accepted: true });
  });
}
