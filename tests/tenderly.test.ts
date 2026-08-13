import { describe, expect, it, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ResolvedCall } from '../src/services/intentResolver.js';
import { BASE_USDC } from '../src/config/baseRpc.js';

const baseCall = {
  to: BASE_USDC as `0x${string}`,
  data: '0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000f4240' as `0x${string}`,
  value: 0n,
  intent: {
    kind: 'transfer' as const,
    agentId: 'a1',
    chainId: 8453 as const,
    tokenIn: BASE_USDC,
    amountIn: '1',
    target: BASE_USDC,
    valueWei: '0',
    slippageBps: 50,
    dryRun: false,
  },
} satisfies ResolvedCall;

describe('simulateOnTenderly + safety', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('parses Tenderly REST success payload', async () => {
    process.env.TENDERLY_ACCESS_KEY = 'tk';
    process.env.TENDERLY_ACCOUNT_SLUG = 'acct';
    process.env.TENDERLY_PROJECT_SLUG = 'proj';
    process.env.BASE_RPC_URL = 'https://mainnet.base.org';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          simulation: { status: true, gas_used: 64831 },
          transaction: {
            transaction_info: {
              balance_changes: [
                {
                  address: BASE_USDC,
                  dollar_value: '-1.00',
                  raw_amount: '1000000',
                  direction: 'out',
                },
              ],
            },
          },
        }),
      }))
    );

    const { simulateOnTenderly } = await import('../src/services/tenderly.js');
    const result = await simulateOnTenderly({
      networkId: '8453',
      from: '0x1111111111111111111111111111111111111111',
      to: BASE_USDC,
      input: '0xa9059cbb',
      value: '0',
    });
    expect(result.success).toBe(true);
    expect(result.gasUsed).toBe(64831);
    expect(result.balanceChanges?.[0]?.dollarValue).toBe('-1.00');
  });

  it('rejects reverted Tenderly simulations with 422 semantics', async () => {
    process.env.TENDERLY_ACCESS_KEY = 'tk';
    process.env.TENDERLY_ACCOUNT_SLUG = 'acct';
    process.env.TENDERLY_PROJECT_SLUG = 'proj';
    process.env.TENDERLY_REQUIRED = 'false';
    process.env.BASE_RPC_URL = 'https://mainnet.base.org';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          simulation: {
            status: false,
            error_message: 'ERC20: transfer amount exceeds balance',
            gas_used: 23410,
          },
        }),
      }))
    );

    const { runPreExecutionSafety } = await import('../src/services/tenderly.js');
    const verdict = await runPreExecutionSafety(
      baseCall,
      '0x1111111111111111111111111111111111111111',
      { dryRun: false, mode: 'live' }
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.httpStatus).toBe(422);
      expect(verdict.code).toBe('TRANSACTION_REVERTED');
      expect(verdict.reason).toMatch(/exceeds balance|revert/i);
    }
  });

  it('rejects oversized balance drains', async () => {
    process.env.TENDERLY_ACCESS_KEY = 'tk';
    process.env.TENDERLY_ACCOUNT_SLUG = 'acct';
    process.env.TENDERLY_PROJECT_SLUG = 'proj';
    process.env.TENDERLY_MAX_DRAIN_USDC = '10';
    process.env.BASE_RPC_URL = 'https://mainnet.base.org';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          simulation: { status: true, gas_used: 100000 },
          transaction: {
            transaction_info: {
              balance_changes: [
                {
                  address: BASE_USDC,
                  dollar_value: '-250',
                  raw_amount: '250000000',
                  direction: 'out',
                },
              ],
            },
          },
        }),
      }))
    );

    const { runPreExecutionSafety } = await import('../src/services/tenderly.js');
    const verdict = await runPreExecutionSafety(
      baseCall,
      '0x1111111111111111111111111111111111111111',
      { dryRun: false, mode: 'live' }
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe('BALANCE_DRAIN');
      expect(verdict.reason).toMatch(/drain/i);
    }
  });
});

describe('POST /v1/intent/execute middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.EXECUTION_MODE = 'mock';
    process.env.NODE_ENV = 'test';
    process.env.API_KEYS = 'dev-agent-key';
    const { buildServer } = await import('../src/app.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Scenario A shape: missing fields → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intent/execute',
      headers: { 'x-api-key': 'dev-agent-key' },
      payload: { calldata: '0x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('Scenario B: mock mode passes Tenderly hook and returns SUCCESS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/intent/execute',
      headers: { 'x-api-key': 'dev-agent-key' },
      payload: {
        fromAddress: '0x1111111111111111111111111111111111111111',
        targetAddress: BASE_USDC,
        calldata:
          '0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000f4240',
        valueWei: '0',
        dryRun: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('SUCCESS');
    expect(body.simulationSummary.status).toBe('PASSED');
  });
});
