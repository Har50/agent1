import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/env.js';
import { apiRoutes } from './routes/api.js';
import {
  registerX402Paywall,
  x402ConfigFromEnv,
} from './middleware/x402Paywall.js';

export async function buildServer() {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  });

  await app.register(cors, {
    origin: true,
    exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'],
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  const x402 = x402ConfigFromEnv();
  if (x402) {
    registerX402Paywall(app, x402);
  }

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AgentExec — Base AI Transaction Provider',
        description:
          'Agentic commerce rail: x402 paywalls, session keys, Tenderly safety, sponsored UserOps on Base',
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
