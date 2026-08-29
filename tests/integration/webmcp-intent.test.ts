import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { AgentExecSDK } from '../../src/sdk/webmcp-adapter.js';

describe('WebMCP x402 /v1/intent', () => {
  let app: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.EXECUTION_MODE = 'mock';
    process.env.NODE_ENV = 'test';
    process.env.API_KEYS = 'dev-agent-key';
    process.env.DATABASE_URL = '';
    process.env.CHAIN_ID = '84532';
    process.env.SESSION_KEY_MODE = 'off';
    process.env.AGENT_PRIVATE_KEY =
      '0xac0974bec39a17e36ba4a6b4d775b877378d5176472b9151b4553270d4ab1122';

    const { reloadConfig } = await import('../../src/config/env.js');
    reloadConfig();
    const { buildServer } = await import('../../src/app.js');
    app = await buildServer();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 8787;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects missing x402 headers with 402', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intent',
      headers: { 'x-api-key': 'dev-agent-key' },
      payload: {
        toolName: 'purchase_premium_data',
        targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        abiMethod: 'transfer',
        args: {},
      },
    });
    expect(res.statusCode).toBe(402);
  });

  it('accepts signed session-key payment and returns SUCCESS in mock mode', async () => {
    const pk = generatePrivateKey();
    const sdk = new AgentExecSDK(baseUrl);
    process.env.AGENT_API_KEY = 'dev-agent-key';

    const result = await sdk.executeToolCall(
      {
        name: 'purchase_premium_data',
        description: 'demo',
        priceUSD: 0.1,
        targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        abiMethod: 'transfer',
      },
      { recipient: '0x1111111111111111111111111111111111111111' },
      pk
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.settledAmountUSD).toBe(0.1);
    expect(result.txHash || result.userOpHash).toBeTruthy();
  });

  it('rejects amount above spend cap', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const payload = JSON.stringify({
      tool: 'drain',
      amountUSD: 50,
      recipient: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      timestamp: Date.now(),
      nonce: '0x01',
    });
    const signature = await account.signMessage({ message: payload });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/intent',
      headers: {
        'x-api-key': 'dev-agent-key',
        'x-402-payment-signature': signature,
        'x-402-payment-payload': payload,
        'x-session-key-address': account.address,
      },
      payload: {
        toolName: 'drain',
        targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        abiMethod: 'transfer',
        args: {},
      },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().error).toBe('Policy Violation');
  });
});
