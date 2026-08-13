/**
 * Print Sepolia / mainnet readiness checklist.
 */
import 'dotenv/config';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import {
  getSmartAccountAddress,
  resolveBaseChain,
  resolvePimlicoRpcUrl,
} from '../src/services/safeAccount.js';
import { config } from '../src/config/env.js';
import { getUsdcAddress } from '../src/config/baseRpc.js';

async function main() {
  console.log('=== Base readiness checklist ===');
  console.log(`CHAIN_ID:         ${config.chainId}`);
  console.log(`BASE_NETWORK:     ${config.BASE_NETWORK}`);
  console.log(`Chain:            ${resolveBaseChain().name}`);
  console.log(`RPC:              ${config.rpcUrls[0]}`);
  console.log(`USDC:             ${getUsdcAddress()}`);
  console.log(`EXECUTION_MODE:   ${config.EXECUTION_MODE}`);
  console.log(
    `Pimlico:          ${resolvePimlicoRpcUrl() ? 'configured' : 'MISSING — set PIMLICO_API_KEY'}`
  );
  console.log(
    `Tenderly:         ${config.tenderlyEnabled ? 'configured' : 'not set'}`
  );
  console.log(`Session key mode: ${config.SESSION_KEY_MODE}`);

  if (!config.AGENT_PRIVATE_KEY) {
    console.log('\n⚠ Set AGENT_PRIVATE_KEY to derive owner + Safe addresses.');
    process.exitCode = 1;
    return;
  }

  const owner = privateKeyToAccount(config.AGENT_PRIVATE_KEY as Hex);
  const safe = await getSmartAccountAddress();
  console.log(`\nOwner EOA:        ${owner.address}`);
  console.log(`Safe (counterfactual): ${safe}`);

  const isSepolia = config.chainId === 84532;
  const base = isSepolia
    ? 'https://sepolia.basescan.org'
    : 'https://basescan.org';
  console.log(`\nExplorer owner:   ${base}/address/${owner.address}`);
  if (safe) console.log(`Explorer Safe:    ${base}/address/${safe}`);
  console.log('Jiffyscan:        https://jiffyscan.xyz');

  if (isSepolia) {
    console.log('\nFunding steps (Sepolia):');
    console.log('  1. Request ETH from https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet');
    console.log(`  2. Send ~0.005 ETH to owner ${owner.address}`);
    console.log(
      `  3. Send ~10 USDC (${getUsdcAddress()}) to Safe ${safe ?? '(derive first)'}`
    );
  }

  console.log('\nNext: EXECUTION_MODE=live npm run sponsored:example');
  console.log('Verify: Tenderly PASSED in logs → UserOp hash → 0 ETH gas on Safe');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
