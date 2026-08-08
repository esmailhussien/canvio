import type { FastifyInstance } from 'fastify';

export const FASTIFY_OPTIONS = {
  logger: true,
  bodyLimit: 256 * 1024,
  requestTimeout: 30_000,
  trustProxy: process.env.NODE_ENV === 'production',
};

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) return;

    const typedError = error as { statusCode?: number; message?: string };
    const statusCode = typeof typedError.statusCode === 'number' && typedError.statusCode >= 400 && typedError.statusCode < 500
      ? typedError.statusCode
      : 500;
    const isClientError = statusCode < 500;

    request.log.error({
      err: error,
      requestId: request.id,
      statusCode,
    }, isClientError ? 'Request rejected' : 'Unhandled request error');

    reply.code(statusCode).send({
      error: isClientError ? 'REQUEST_FAILED' : 'INTERNAL_SERVER_ERROR',
      message: isClientError ? typedError.message || 'The request could not be completed.' : 'Canvio could not complete the request.',
      requestId: request.id,
    });
  });
}
