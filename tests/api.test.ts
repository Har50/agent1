import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { BASE_USDC } from '../src/config/baseRpc.js';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.EXECUTION_MODE = 'mock';
  process.env.NODE_ENV = 'test';
  process.env.API_KEYS = 'dev-agent-key';
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('HTTP API', () => {
  it('health is public', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('rejects missing API key', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/meta' });
    expect(res.statusCode).toBe(401);
  });

  it('executes mock intent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intents',
      headers: { 'x-api-key': 'dev-agent-key' },
      payload: {
        kind: 'transfer',
        agentId: 'http-agent',
        tokenIn: BASE_USDC,
        recipient: '0x1111111111111111111111111111111111111111',
        amountIn: '2',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toMatch(/simulated|submitted/);
    expect(body.userOpHash || body.txHash).toBeTruthy();
  });

  it('creates a session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { 'x-api-key': 'dev-agent-key' },
      payload: {
        agentId: 'http-agent',
        sessionId: 'sess-1',
        maxSpendUsdc: 50,
        allowedTargets: ['0x2626664c2603336E57B271c5C0b26F421741e481'],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().sessionId).toBe('sess-1');
  });

  it('returns account sponsorship metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/account',
      headers: { 'x-api-key': 'dev-agent-key' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sponsorshipReady).toBe(false);
    expect(body).toHaveProperty('smartAccount');
    expect(body).toHaveProperty('owner');
  });

  it('issues a session key scope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/session-keys',
      headers: { 'x-api-key': 'dev-agent-key' },
      payload: {
        id: 'sk-http-1',
        agentId: 'http-agent',
        publicKey: '0xSessionPub',
        maxSpendUsdc: 50,
        allowedTargets: ['0x2626664c2603336E57B271c5C0b26F421741e481'],
        allowedSelectors: ['0xa9059cbb'],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe('sk-http-1');
    expect(res.json().maxSpendUsdc).toBe(50);
  });
});
