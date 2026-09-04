/**
 * Live WebMCP intent smoke test against the production gateway.
 *
 * Uses this repo's SDK (`AgentExecSDK`). When published, the same surface is:
 *   import { AgentExecSDK } from '@agentexec/sdk'
 *
 * Usage:
 *   AGENT_API_KEY=<same as Render API_KEYS> npx tsx scripts/test-intent.ts
 *   GATEWAY_URL=https://api.agentexec.dev npx tsx scripts/test-intent.ts
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import {
  AgentExecSDK,
  type WebMCPToolPayload,
} from '../src/sdk/webmcp-adapter.js';

async function run() {
  const gatewayBase =
    process.env.GATEWAY_URL?.replace(/\/$/, '') ||
    'https://api.agentexec.dev';
  // AgentExecSDK appends /v1/intent (not /api/v1/intent) — both aliases exist.
  const client = new AgentExecSDK(gatewayBase);

  console.log('======================================================');
  console.log(' AgentExec WebMCP Intent Execution Test (TypeScript)');
  console.log(` Gateway: ${gatewayBase}`);
  console.log(` Chain:   Base (${base.id})`);
  console.log('======================================================');
  console.log();

  if (!process.env.AGENT_API_KEY && !process.env.API_KEYS) {
    console.warn(
      'Warning: AGENT_API_KEY not set. Gateway will return 401 until you export the same value as Render API_KEYS.\n'
    );
  } else if (!process.env.AGENT_API_KEY && process.env.API_KEYS) {
    // SDK reads AGENT_API_KEY / NEXT_PUBLIC_AGENT_API_KEY
    process.env.AGENT_API_KEY = process.env.API_KEYS.split(',')[0]!.trim();
  }

  // 1. Ephemeral session key (viem)
  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);
  const validUntil = Math.floor(Date.now() / 1000) + 3600;

  console.log(`Generated Session Key: ${sessionAccount.address}`);
  console.log(`Expires At:            ${new Date(validUntil * 1000).toISOString()}`);
  console.log(`Spend cap (policy):     $10.00 USDC per intent (gateway default)`);
  console.log();

  // 2. Tool / intent payload (WebMCP shape)
  const tool: WebMCPToolPayload = {
    name: 'purchase_premium_data',
    description: 'Live gateway smoke test — Base USDC target',
    priceUSD: 0.1,
    targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
    abiMethod: 'transfer(address,uint256)',
  };

  console.log('Submitting signed x402 tool call via AgentExecSDK.executeToolCall...');
  console.log(`  tool:            ${tool.name}`);
  console.log(`  priceUSD:        ${tool.priceUSD}`);
  console.log(`  targetContract:  ${tool.targetContract}`);
  console.log();

  try {
    const response = await client.executeToolCall(
      tool,
      {
        endpoint: '/analytics',
        recipient: '0x1111111111111111111111111111111111111111',
      },
      sessionPrivateKey
    );

    console.log('Intent Executed Successfully:');
    console.log(`- Status:            ${response.status}`);
    console.log(`- Tool:              ${response.tool ?? tool.name}`);
    console.log(`- Settled Amount:    ${response.settledAmountUSD ?? tool.priceUSD}`);
    console.log(`- UserOp Hash:       ${response.userOpHash ?? '(none)'}`);
    console.log(`- Transaction Hash:  ${response.txHash ?? '(none)'}`);
    console.log(`- Network:           ${response.network ?? 'Base'}`);
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; statusCode?: number };
    const message = err.message || String(error);

    if (
      message.includes('402') ||
      err.status === 402 ||
      err.statusCode === 402
    ) {
      console.warn('HTTP 402 Payment Required / authorization failed:');
      console.warn(message);
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      console.error('HTTP 401 Unauthorized — set AGENT_API_KEY to match Render API_KEYS.');
      console.error(message);
      process.exitCode = 1;
    } else {
      console.error('Execution Failed:', message);
      process.exitCode = 1;
    }
  }

  console.log();
  console.log('======================================================');
  console.log(' Intent test sequence complete.');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
