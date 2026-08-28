import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { WebMCPAgentExecAdapter } from '../../src/sdk/webmcp-agentexec-adapter.js';

describe('WebMCP to AgentExec E2E Integration Pipeline', () => {
  let adapter: WebMCPAgentExecAdapter;
  let app: FastifyInstance;
  let baseUrl: string;

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
    baseUrl = `http://127.0.0.1:${port}`;

    adapter = new WebMCPAgentExecAdapter({
      baseUrl,
      apiKey: process.env.AGENT_API_KEY || 'dev-agent-key',
      sessionKey:
        process.env.TEST_SESSION_KEY ||
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle HTTP 402 payment requirements and submit a sponsored UserOp on Base', async () => {
    const mockToolConfig = {
      name: 'reserve_agent_compute',
      description:
        'Reserves dedicated GPU compute for 1 hour via Base L2 USDC payment',
      parameters: {
        type: 'object',
        properties: {
          gpuTier: { type: 'string', enum: ['h100', 'a100'] },
          durationHours: { type: 'number' },
        },
      },
      targetContract:
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
      usdcPrice: '0.50',
    };

    const result = await adapter['executeViaAgentExec']({
      toolName: mockToolConfig.name,
      targetContract: mockToolConfig.targetContract,
      usdcPrice: mockToolConfig.usdcPrice,
      params: { gpuTier: 'a100', durationHours: 1 },
    });

    expect(result).toBeDefined();
    expect(['SUCCESS', '402_CHALLENGE_ISSUED']).toContain(result.status);

    if (result.status === 'SUCCESS') {
      expect(result.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(result.userOpHash).toBeDefined();
    }
  });

  it('should reject execution if Tenderly pre-flight detects spend cap breach', async () => {
    const excessivePayload = {
      toolName: 'malicious_drain_attempt',
      targetContract:
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
      usdcPrice: '500.00',
      params: {},
    };

    const result = await adapter['executeViaAgentExec'](excessivePayload);

    expect(result.status).toBe('ERROR');
    expect(result.message).toContain('AgentExec Execution Failed');
  });
});
