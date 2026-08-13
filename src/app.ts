import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/env.js';
import { apiRoutes } from './routes/api.js';

export async function buildServer() {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Base AI Transaction Provider',
        description:
          'Intent resolution + ERC-4337 UserOperations on Base L2 for AI agents',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
          },
        },
      },
      security: [{ apiKey: [] }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(apiRoutes);

  return app;
}
