import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { config } from '../config/env.js';
import { processIntent } from '../services/pipeline.js';
import { intentSchema, sessionKeySchema } from '../schemas/intent.js';
import { issueSessionKeySchema } from '../schemas/sessionKey.js';
import {
  getTransaction,
  upsertSession,
  upsertSessionKeyScope,
} from '../db/repository.js';
import { getAgentAddress } from '../services/userOp.js';
import {
  canUseSponsoredSafe,
  getSmartAccountAddress,
  resolveBaseChain,
} from '../services/safeAccount.js';
import { provisionZeroDevSessionHint } from '../services/sessionKeys.js';
import { createAgentSessionKey } from '../services/sessionKey.js';
import { isTenderlyConfigured } from '../services/tenderly.js';
import { getUsdcAddress, UNISWAP_V3_ROUTER } from '../config/baseRpc.js';
import { intentExecuteRoutes } from './intentRoute.js';
import { z } from 'zod';
import { addressSchema } from '../schemas/intent.js';

function extractApiKey(req: FastifyRequest): string | undefined {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return undefined;
}

export const apiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health' || req.url.startsWith('/docs')) return;
    const key = extractApiKey(req);
    if (!key || !config.apiKeys.has(key)) {
      return reply.code(401).send({ error: 'Unauthorized — provide X-API-Key' });
    }
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'base-ai-tx-provider',
    chainId: resolveBaseChain().id,
    network: config.BASE_NETWORK,
    mode: config.EXECUTION_MODE,
    agent: getAgentAddress(),
  }));

  app.get('/v1/meta', async () => ({
    chainId: resolveBaseChain().id,
    network: config.BASE_NETWORK,
    usdc: getUsdcAddress(),
    uniswapV3Router: UNISWAP_V3_ROUTER,
    mode: config.EXECUTION_MODE,
    sponsorship: {
      enabled: canUseSponsoredSafe(),
      provider: canUseSponsoredSafe() ? 'pimlico+safe' : null,
      entryPoint: '0.7',
      safeVersion: '1.4.1',
    },
    safety: {
      tenderly: isTenderlyConfigured(),
      tenderlyRequired: config.TENDERLY_REQUIRED,
      maxDrainUsdc: config.TENDERLY_MAX_DRAIN_USDC,
    },
    sessionKeys: {
      mode: config.SESSION_KEY_MODE,
      zerodevProject: Boolean(config.ZERODEV_PROJECT_ID),
    },
    owner: getAgentAddress(),
    publicBaseUrl: config.PUBLIC_BASE_URL || null,
    capabilities: [
      'swap',
      'transfer',
      'approve',
      'custom',
      'mcp',
      'sponsored-safe',
      'tenderly-safety',
      'session-keys',
    ],
  }));

  app.get('/v1/account', async (_req, reply) => {
    const owner = getAgentAddress();
    const smartAccount = await getSmartAccountAddress();
    return reply.send({
      network: config.BASE_NETWORK,
      chainId: resolveBaseChain().id,
      owner,
      smartAccount,
      sponsorshipReady: canUseSponsoredSafe(),
      explorers: {
        address: smartAccount
          ? config.BASE_NETWORK === 'baseSepolia'
            ? `https://sepolia.basescan.org/address/${smartAccount}`
            : `https://basescan.org/address/${smartAccount}`
          : null,
        jiffyscan: 'https://jiffyscan.xyz',
      },
      note: smartAccount
        ? 'Counterfactual Safe address — deploys on first sponsored UserOp'
        : 'Set AGENT_PRIVATE_KEY to derive the Safe address',
    });
  });

  app.post('/v1/intents', async (req, reply) => {
    const parsed = intentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid intent',
        details: parsed.error.flatten(),
      });
    }
    const result = await processIntent(parsed.data);
    const code =
      result.status === 'rejected'
        ? 422
        : result.status === 'failed'
          ? 502
          : 200;
    return reply.code(code).send(result);
  });

  app.post('/v1/intents/simulate', async (req, reply) => {
    const parsed = intentSchema.safeParse({
      ...(req.body as object),
      dryRun: true,
    });
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid intent',
        details: parsed.error.flatten(),
      });
    }
    const result = await processIntent(parsed.data);
    const code = result.status === 'rejected' ? 422 : 200;
    return reply.code(code).send(result);
  });

  app.get<{ Params: { intentId: string } }>(
    '/v1/intents/:intentId',
    async (req, reply) => {
      const row = await getTransaction(req.params.intentId);
      if (!row) return reply.code(404).send({ error: 'Not found' });
      return reply.send(row);
    }
  );

  app.post('/v1/sessions', async (req, reply) => {
    const parsed = sessionKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid session',
        details: parsed.error.flatten(),
      });
    }
    const session = await upsertSession(parsed.data);
    return reply.code(201).send(session);
  });

  /** Issue / upsert ERC-7579-style session key scopes (DB + optional ZeroDev). */
  app.post('/v1/session-keys', async (req, reply) => {
    const parsed = issueSessionKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid session key',
        details: parsed.error.flatten(),
      });
    }
    let scope = {
      ...parsed.data,
      spentUsdc: 0,
      windowStartedAt: new Date().toISOString(),
    };
    scope = await provisionZeroDevSessionHint(scope);
    const saved = await upsertSessionKeyScope(scope);
    return reply.code(201).send(saved);
  });

  /**
   * Generate ephemeral ZeroDev session key (24h, USDC transfer ≤ cap).
   * Returns sessionPrivateKey once — store securely; only public scope is persisted.
   */
  app.post('/v1/session-keys/issue', async (req, reply) => {
    const bodySchema = z.object({
      agentId: z.string().min(1).max(128),
      sessionId: z.string().min(1).max(128).optional(),
      target: addressSchema.optional(),
      maxUsdc: z.number().positive().optional(),
      ttlHours: z.number().positive().optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid issue request',
        details: parsed.error.flatten(),
      });
    }
    const created = await createAgentSessionKey({
      ...parsed.data,
      target: parsed.data.target as `0x${string}` | undefined,
    });
    return reply.code(201).send({
      sessionKeyAddress: created.sessionKeyAddress,
      sessionPrivateKey: created.sessionPrivateKey,
      validatorReady: created.validatorReady,
      permissions: created.permissions,
      scope: {
        id: created.scope.id,
        agentId: created.scope.agentId,
        maxSpendUsdc: created.scope.maxSpendUsdc,
        allowedTargets: created.scope.allowedTargets,
        allowedSelectors: created.scope.allowedSelectors,
        expiresAt: created.scope.expiresAt,
      },
      warning:
        'sessionPrivateKey is returned once — treat as a secret. DB stores public scope only.',
    });
  });

  await app.register(intentExecuteRoutes);
};
