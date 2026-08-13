import { describe, expect, it, beforeAll } from 'vitest';
import { createAgentSessionKey } from '../src/services/sessionKey.js';
import { getSessionKeyScope } from '../src/db/repository.js';
import { BASE_USDC } from '../src/config/baseRpc.js';

beforeAll(() => {
  process.env.SESSION_KEY_MODE = 'db';
  process.env.EXECUTION_MODE = 'mock';
  process.env.NODE_ENV = 'test';
});

describe('createAgentSessionKey', () => {
  it('issues ephemeral key with USDC transfer scope', async () => {
    const created = await createAgentSessionKey({
      agentId: 'zk-agent',
      maxUsdc: 50,
      ttlHours: 24,
      target: BASE_USDC,
    });

    expect(created.sessionKeyAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(created.sessionPrivateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(created.permissions.maxAmountWei).toBe(String(50_000_000n));
    expect(created.scope.allowedSelectors).toContain('0xa9059cbb');
    expect(created.scope.allowedTargets[0]?.toLowerCase()).toBe(
      BASE_USDC.toLowerCase()
    );

    const stored = await getSessionKeyScope(created.scope.id);
    expect(stored?.publicKey).toBe(created.sessionKeyAddress);
    expect(stored?.metadata).not.toHaveProperty('sessionPrivateKey');
  });
});
