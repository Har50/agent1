/**
 * Demo: issue an ERC-7579 / ZeroDev-scoped session key (DB always; on-chain when MODE=zerodev).
 */
import 'dotenv/config';
import { createAgentSessionKey } from '../src/services/sessionKey.js';

async function main() {
  const agentId = process.env.DEMO_AGENT_ID || 'demo-agent';
  const created = await createAgentSessionKey({
    agentId,
    maxUsdc: Number(process.env.SESSION_KEY_MAX_USDC || 50),
    ttlHours: Number(process.env.SESSION_KEY_TTL_HOURS || 24),
  });

  console.log('Session key issued');
  console.log(JSON.stringify({
    sessionKeyAddress: created.sessionKeyAddress,
    sessionPrivateKey: created.sessionPrivateKey,
    validatorReady: created.validatorReady,
    permissions: created.permissions,
    scopeId: created.scope.id,
    expiresAt: created.scope.expiresAt,
  }, null, 2));
  console.log('\nStore sessionPrivateKey securely — it is not saved to the DB.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
