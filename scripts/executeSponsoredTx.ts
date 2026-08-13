/**
 * Production example: gas-sponsored (paymaster) transaction on Base via
 * Safe Smart Account (ERC-4337) + Pimlico bundler/paymaster.
 *
 * Local EOA (`AGENT_PRIVATE_KEY`) is the Safe owner/signer.
 * The Safe submits the UserOperation; Pimlico sponsors gas (agent pays 0 ETH).
 *
 *   cp .env.example .env   # set AGENT_PRIVATE_KEY + PIMLICO_API_KEY
 *   npm run sponsored:example
 *
 * Use BASE_NETWORK=baseSepolia for testnet.
 *
 * Key concepts:
 * - toSafeSmartAccount: counterfactual ERC-4337 address; deploys on first UserOp
 * - paymaster: pimlicoClient: requests paymaster signature before broadcast
 * - sendTransaction: turns {to,data,value} into a signed UserOperation
 */
import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { createSmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import 'dotenv/config';

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY as string | undefined;
const NETWORK = (process.env.BASE_NETWORK || 'base') as 'base' | 'baseSepolia';

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error('Set AGENT_PRIVATE_KEY in .env');
  }
  if (!PIMLICO_API_KEY && !process.env.BUNDLER_RPC_URL) {
    throw new Error('Set PIMLICO_API_KEY (or BUNDLER_RPC_URL) in .env');
  }

  const { base, baseSepolia } = await import('viem/chains');
  const chain = NETWORK === 'baseSepolia' ? baseSepolia : base;
  const RPC_URL =
    process.env.BASE_RPC_URL ||
    (NETWORK === 'baseSepolia'
      ? 'https://sepolia.base.org'
      : 'https://mainnet.base.org');
  const PIMLICO_RPC_URL =
    process.env.BUNDLER_RPC_URL ||
    `https://api.pimlico.io/v2/${NETWORK === 'baseSepolia' ? 'base-sepolia' : 'base'}/rpc?apikey=${PIMLICO_API_KEY}`;

  // 1. Standard viem public client
  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL),
  });

  // 2. Agent owner EOA (signer)
  const signer = privateKeyToAccount(PRIVATE_KEY);
  console.log(`Agent Owner Address: ${signer.address}`);
  console.log(`Chain: ${chain.name} (${chain.id})`);

  // 3. Pimlico bundler + paymaster (EntryPoint 0.7)
  const pimlicoClient = createPimlicoClient({
    transport: http(PIMLICO_RPC_URL),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
  });

  // 4. Safe Smart Wallet v1.4.1 (counterfactual until first sponsored tx)
  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [signer],
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
    version: '1.4.1',
  });
  console.log(`Smart Account (ERC-4337) Address: ${safeAccount.address}`);

  // 5. Smart account client with paymaster middleware
  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain,
    bundlerTransport: http(PIMLICO_RPC_URL),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () =>
        (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  // 6. Example call: transfer 1 USDC
  const usdcAddress =
    chain.id === 8453
      ? ('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const)
      : ('0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const);
  const usdcAbi = parseAbi([
    'function transfer(address to, uint256 amount) returns (bool)',
  ]);
  const recipient =
    (process.env.SPONSORED_RECIPIENT as Hex | undefined) ??
    '0x0000000000000000000000000000000000000001';
  const amount = BigInt(process.env.SPONSORED_AMOUNT_WEI ?? '1000000');

  const callData = encodeFunctionData({
    abi: usdcAbi,
    functionName: 'transfer',
    args: [recipient, amount],
  });

  console.log('Submitting sponsored UserOperation to Base...');

  // 7. Execute — gas 100% sponsored by the paymaster
  const txHash = await smartAccountClient.sendTransaction({
    to: usdcAddress,
    data: callData,
    value: 0n,
  });
  console.log(`UserOp submitted! Transaction Hash: ${txHash}`);

  // 8. Wait for on-chain receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`Transaction mined in block ${receipt.blockNumber}!`);
  const explorer =
    chain.id === 8453
      ? `https://basescan.org/tx/${receipt.transactionHash}`
      : `https://sepolia.basescan.org/tx/${receipt.transactionHash}`;
  console.log(`Explorer Link: ${explorer}`);
}

main().catch((err) => {
  console.error('Error executing sponsored transaction:', err);
  process.exit(1);
});
