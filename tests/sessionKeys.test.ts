import { describe, expect, it, beforeAll } from 'vitest';
import {
  enforceSessionKeyScope,
  recordSessionKeySpend,
} from '../src/services/sessionKeys.js';
import { upsertSessionKeyScope } from '../src/db/repository.js';
import { resolveIntent } from '../src/services/intentResolver.js';
import { BASE_USDC, UNISWAP_V3_ROUTER } from '../src/config/baseRpc.js';

beforeAll(() => {
  process.env.SESSION_KEY_MODE = 'db';
  process.env.EXECUTION_MODE = 'mock';
});

describe('session key scopes', () => {
  it('blocks non-whitelisted targets', async () => {
    await upsertSessionKeyScope({
      id: 'sk-test-1',
      agentId: 'agent-sk',
      publicKey: '0xabc',
      maxSpendUsdc: 50,
      spentUsdc: 0,
      spendWindowSeconds: 86_400,
      windowStartedAt: new Date().toISOString(),
      allowedTargets: [UNISWAP_V3_ROUTER],
      allowedSelectors: [],
      active: true,
    });

    const call = resolveIntent({
      kind: 'transfer',
      agentId: 'agent-sk',
      sessionKeyId: 'sk-test-1',
      tokenIn: BASE_USDC,
      recipient: '0x1111111111111111111111111111111111111111',
      amountIn: '1',
    });

    const verdict = await enforceSessionKeyScope(
      call.intent,
      call,
      'sk-test-1'
    );
    expect(verdict.ok).toBe(false);
  });

  it('enforces rolling spend caps', async () => {
    await upsertSessionKeyScope({
      id: 'sk-test-2',
      agentId: 'agent-sk-2',
      publicKey: '0xdef',
      maxSpendUsdc: 5,
      spentUsdc: 4,
      spendWindowSeconds: 86_400,
      windowStartedAt: new Date().toISOString(),
      allowedTargets: [BASE_USDC],
      allowedSelectors: [],
      active: true,
    });

    const call = resolveIntent({
      kind: 'transfer',
      agentId: 'agent-sk-2',
      sessionKeyId: 'sk-test-2',
      tokenIn: BASE_USDC,
      recipient: '0x1111111111111111111111111111111111111111',
      amountIn: '2',
    });

    const verdict = await enforceSessionKeyScope(
      call.intent,
      call,
      'sk-test-2'
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/spend cap/i);
  });

  it('records spend after success', async () => {
    const scope = await upsertSessionKeyScope({
      id: 'sk-test-3',
      agentId: 'agent-sk-3',
      publicKey: '0xghi',
      maxSpendUsdc: 50,
      spentUsdc: 1,
      spendWindowSeconds: 86_400,
      windowStartedAt: new Date().toISOString(),
      allowedTargets: [],
      allowedSelectors: [],
      active: true,
    });
    await recordSessionKeySpend(scope, {
      kind: 'transfer',
      agentId: 'agent-sk-3',
      chainId: 8453,
      amountIn: '3',
      valueWei: '0',
      slippageBps: 50,
      dryRun: false,
    });
    const { getSessionKeyScope } = await import('../src/db/repository.js');
    const updated = await getSessionKeyScope('sk-test-3');
    expect(updated?.spentUsdc).toBe(4);
  });
});
