import { describe, expect, it, beforeAll } from 'vitest';
import { resolveIntent, IntentResolutionError } from '../src/services/intentResolver.js';
import { enforceGuardrails, estimateSpendUsdc } from '../src/services/guardrails.js';
import { processIntent } from '../src/services/pipeline.js';
import { BASE_USDC, UNISWAP_V3_ROUTER } from '../src/config/baseRpc.js';
import type { SessionKey } from '../src/schemas/intent.js';

beforeAll(() => {
  process.env.EXECUTION_MODE = 'mock';
  process.env.NODE_ENV = 'test';
});

describe('resolveIntent', () => {
  it('encodes ERC-20 transfer calldata', () => {
    const call = resolveIntent({
      kind: 'transfer',
      agentId: 'agent-1',
      tokenIn: BASE_USDC,
      recipient: '0x1111111111111111111111111111111111111111',
      amountIn: '10',
    });
    expect(call.to.toLowerCase()).toBe(BASE_USDC.toLowerCase());
    expect(call.data.startsWith('0xa9059cbb')).toBe(true);
    expect(call.value).toBe(0n);
  });

  it('encodes Uniswap v3 exactInputSingle for swaps', () => {
    const call = resolveIntent({
      kind: 'swap',
      agentId: 'agent-1',
      tokenIn: BASE_USDC,
      tokenOut: '0x4200000000000000000000000000000000000006',
      amountIn: '50',
      recipient: '0x1111111111111111111111111111111111111111',
    });
    expect(call.to.toLowerCase()).toBe(UNISWAP_V3_ROUTER.toLowerCase());
    expect(call.data.length).toBeGreaterThan(10);
  });

  it('rejects custom without target/data', () => {
    expect(() =>
      resolveIntent({ kind: 'custom', agentId: 'a' })
    ).toThrow(IntentResolutionError);
  });
});

describe('guardrails', () => {
  const session: SessionKey = {
    agentId: 'agent-1',
    sessionId: 's1',
    maxSpendUsdc: 100,
    spentUsdc: 90,
    allowedTargets: [UNISWAP_V3_ROUTER],
    active: true,
  };

  it('blocks over-spend', () => {
    const verdict = enforceGuardrails(
      {
        kind: 'swap',
        agentId: 'agent-1',
        chainId: 8453,
        amountIn: '20',
        target: UNISWAP_V3_ROUTER,
        valueWei: '0',
        slippageBps: 50,
        dryRun: false,
      },
      session
    );
    expect(verdict.ok).toBe(false);
  });

  it('blocks non-allowlisted targets', () => {
    const verdict = enforceGuardrails(
      {
        kind: 'custom',
        agentId: 'agent-1',
        chainId: 8453,
        target: '0x2222222222222222222222222222222222222222',
        data: '0x',
        valueWei: '0',
        slippageBps: 50,
        dryRun: false,
      },
      session
    );
    expect(verdict.ok).toBe(false);
  });

  it('estimates USDC spend from amountIn', () => {
    expect(estimateSpendUsdc({ amountIn: '12.5' } as never)).toBe(12.5);
  });
});

describe('processIntent (mock mode)', () => {
  it('simulates a transfer successfully', async () => {
    const result = await processIntent({
      kind: 'transfer',
      agentId: 'agent-demo',
      sessionId: 'session-demo',
      tokenIn: BASE_USDC,
      recipient: '0x1111111111111111111111111111111111111111',
      amountIn: '1',
      dryRun: true,
    });
    expect(result.status).toBe('simulated');
    expect(result.simulation?.success).toBe(true);
    expect(result.intentId).toMatch(/^intent_/);
  });

  it('rejects invalid schema', async () => {
    const result = await processIntent({ kind: 'transfer', agentId: 'x' });
    expect(result.status).toBe('rejected');
  });
});
