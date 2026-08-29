import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { AgentExecSDK } from '../../src/sdk/webmcp-adapter.js';
import { WebMCPAgentExecAdapter } from '../../src/sdk/webmcp-agentexec-adapter.js';

describe('simulateTransaction (Tenderly pre-flight helper)', () => {
  it('returns mock pass when Tenderly credentials are missing', async () => {
    delete process.env.TENDERLY_ACCESS_KEY;
    delete process.env.TENDERLY_ACCOUNT_SLUG;
    delete process.env.TENDERLY_PROJECT_SLUG;
    const { reloadConfig } = await import('../../src/config/env.js');
    reloadConfig();
    const { simulateTransaction } = await import(
      '../../src/middleware/simulateHook.js'
    );

    const result = await simulateTransaction({
      from: '0x1111111111111111111111111111111111111111',
      to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      data: '0xa9059cbb',
      networkId: '84532',
    });
    expect(result.success).toBe(true);
    expect(result.gasUsed).toBe(120_000);
  });
});

describe('WebMCPAgentExecAdapter E2E (402 + UserOp path)', () => {
  let adapter: WebMCPAgentExecAdapter;
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.EXECUTION_MODE = 'mock';
    process.env.NODE_ENV = 'test';
    process.env.API_KEYS = 'dev-agent-key';
    process.env.DATABASE_URL = '';
    process.env.CHAIN_ID = '84532';
    process.env.AGENT_PRIVATE_KEY =
      '0xac0974bec39a17e36ba4a6b4d775b877378d5176472b9151b4553270d4ab1122';
    process.env.SESSION_KEY_MODE = 'off';

    const { reloadConfig } = await import('../../src/config/env.js');
    reloadConfig();
    const { buildServer } = await import('../../src/app.js');
    app = await buildServer();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 8787;
    const baseUrl = `http://127.0.0.1:${port}`;

    adapter = new WebMCPAgentExecAdapter({
      baseUrl,
      apiKey: 'dev-agent-key',
      fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle HTTP 402 payment requirements and submit a sponsored UserOp on Base', async () => {
    const result = await adapter.executeViaAgentExec({
      toolName: 'reserve_agent_compute',
      targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      usdcPrice: '0.50',
      params: { gpuTier: 'a100', durationHours: 1 },
    });
    expect(['SUCCESS', '402_CHALLENGE_ISSUED']).toContain(result.status);
    if (result.status === 'SUCCESS') {
      expect(result.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(result.userOpHash).toBeDefined();
    }
  });

  it('should reject execution if spend cap breach is detected', async () => {
    const result = await adapter.executeViaAgentExec({
      toolName: 'malicious_drain_attempt',
      targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      usdcPrice: '500.00',
      params: {},
    });
    expect(result.status).toBe('ERROR');
    expect(result.message).toContain('AgentExec Execution Failed');
  });
});

describe('WebMCP + AgentExec Integration Test Suite (/v1/intent)', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let sessionPk: `0x${string}`;
  let sessionAddress: `0x${string}`;

  beforeAll(async () => {
    process.env.EXECUTION_MODE = 'mock';
    process.env.NODE_ENV = 'test';
    process.env.API_KEYS = 'dev-agent-key';
    process.env.DATABASE_URL = '';
    process.env.CHAIN_ID = '84532';
    process.env.SESSION_KEY_MODE = 'off';
    process.env.AGENT_PRIVATE_KEY =
      '0xac0974bec39a17e36ba4a6b4d775b877378d5176472b9151b4553270d4ab1122';
    process.env.AGENT_API_KEY = 'dev-agent-key';

    const { reloadConfig } = await import('../../src/config/env.js');
    reloadConfig();
    const { buildServer } = await import('../../src/app.js');
    app = await buildServer();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 8787;
    baseUrl = `http://127.0.0.1:${port}`;

    sessionPk = generatePrivateKey();
    sessionAddress = privateKeyToAccount(sessionPk).address;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully execute a WebMCP tool call with a valid 402 payment signature', async () => {
    const sdk = new AgentExecSDK(baseUrl);
    const result = await sdk.executeToolCall(
      {
        name: 'purchase_premium_data',
        description: 'Fetch live AI agent analytics feed',
        priceUSD: 0.1,
        targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        abiMethod: 'fetchData()',
      },
      { endpoint: '/analytics' },
      sessionPk
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.tool).toBe('purchase_premium_data');
    expect(result.settledAmountUSD).toBe(0.1);
    expect(result.txHash || result.userOpHash).toBeDefined();
    expect(String(result.txHash || result.userOpHash)).toMatch(/^0x/);
  });

  it('should reject execution if transaction amount exceeds the $10.00 spend-cap policy', async () => {
    const sdk = new AgentExecSDK(baseUrl);
    await expect(
      sdk.executeToolCall(
        {
          name: 'expensive_action',
          description: 'Exceeds per-intent spend cap limit',
          priceUSD: 15.0,
          targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          abiMethod: 'execute()',
        },
        {},
        sessionPk
      )
    ).rejects.toThrow(/402 Payment Authorization Failed|spend cap/i);
  });

  it('should return 401 Unauthorized if the session key address does not match the signature', async () => {
    const attacker = privateKeyToAccount(generatePrivateKey());
    const payloadString = JSON.stringify({
      tool: 'purchase_premium_data',
      amountUSD: 0.5,
      recipient: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      timestamp: Date.now(),
      nonce: '0x01',
    });
    const tamperedSignature = await attacker.signMessage({
      message: payloadString,
    });

    const res = await fetch(`${baseUrl}/api/v1/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dev-agent-key',
        'X-402-Payment-Signature': tamperedSignature,
        'X-402-Payment-Payload': payloadString,
        'X-Session-Key-Address': sessionAddress,
      },
      body: JSON.stringify({
        toolName: 'purchase_premium_data',
        targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        abiMethod: 'fetchData()',
        args: {},
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('Session Key signature verification failed');
  });

  it('should return 402 Payment Required when required x402 headers are missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dev-agent-key',
      },
      body: JSON.stringify({
        toolName: 'purchase_premium_data',
        targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        abiMethod: 'fetchData()',
      }),
    });

    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Payment Required');
  });
});
