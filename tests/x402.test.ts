import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { parseUnits } from 'viem';

describe('x402 paywall', () => {
  let app: FastifyInstance;
  const recipient = '0x2222222222222222222222222222222222222222';

  beforeAll(async () => {
    process.env.EXECUTION_MODE = 'mock';
    process.env.NODE_ENV = 'test';
    process.env.API_KEYS = 'dev-agent-key';
    process.env.DATABASE_URL = '';
    process.env.X402_ENABLED = 'true';
    process.env.X402_PRICE_USDC = '0.01';
    process.env.X402_RECIPIENT = recipient;
    process.env.X402_PATH_PREFIXES = '/v1/paid';
    process.env.CHAIN_ID = '84532';

    const { reloadConfig } = await import('../src/config/env.js');
    reloadConfig();
    const { buildServer } = await import('../src/app.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 402 PAYMENT-REQUIRED without signature', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/paid/market-pulse',
      headers: { 'x-api-key': 'dev-agent-key' },
    });
    expect(res.statusCode).toBe(402);
    expect(res.headers['payment-required']).toBeTruthy();
    const body = res.json();
    expect(body.code).toBe(402);
  });

  it('allows request with valid PAYMENT-SIGNATURE', async () => {
    const amount = parseUnits('0.01', 6).toString();
    const envelope = Buffer.from(
      JSON.stringify({
        signature: '0x' + 'ab'.repeat(65),
        payload: {
          from: '0x1111111111111111111111111111111111111111',
          to: recipient,
          value: amount,
          validBefore: Math.floor(Date.now() / 1000) + 600,
        },
      })
    ).toString('base64');

    const res = await app.inject({
      method: 'GET',
      url: '/v1/paid/market-pulse',
      headers: {
        'x-api-key': 'dev-agent-key',
        'payment-signature': envelope,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['payment-response']).toBeTruthy();
    expect(res.json().paidBy).toBe(
      '0x1111111111111111111111111111111111111111'
    );
  });

  it('rejects underpayment', async () => {
    const envelope = Buffer.from(
      JSON.stringify({
        signature: '0xsig',
        payload: {
          from: '0x1111111111111111111111111111111111111111',
          to: recipient,
          value: '1',
        },
      })
    ).toString('base64');

    const res = await app.inject({
      method: 'GET',
      url: '/v1/paid/market-pulse',
      headers: {
        'x-api-key': 'dev-agent-key',
        'payment-signature': envelope,
      },
    });
    expect(res.statusCode).toBe(402);
  });
});
