import {
  createPublicClient,
  http,
  type Address,
  type Chain,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { entryPoint07Address } from 'viem/account-abstraction';
import { createSmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { config, type AppConfig } from '../config/env.js';

export type SponsoredSendResult = {
  txHash: Hex;
  smartAccountAddress: Address;
  ownerAddress: Address;
  blockNumber?: string;
};

export function resolveBaseChain(cfg: AppConfig = config): Chain {
  return cfg.BASE_NETWORK === 'baseSepolia' ? baseSepolia : base;
}

/**
 * Prefer explicit bundler URL; otherwise build Pimlico v2 RPC from API key + network.
 */
export function resolvePimlicoRpcUrl(cfg: AppConfig = config): string | null {
  if (cfg.BUNDLER_RPC_URL) return cfg.BUNDLER_RPC_URL;
  if (cfg.PAYMASTER_RPC_URL) return cfg.PAYMASTER_RPC_URL;
  if (!cfg.PIMLICO_API_KEY) return null;
  const network = cfg.BASE_NETWORK === 'baseSepolia' ? 'base-sepolia' : 'base';
  return `https://api.pimlico.io/v2/${network}/rpc?apikey=${cfg.PIMLICO_API_KEY}`;
}

export function canUseSponsoredSafe(cfg: AppConfig = config): boolean {
  return Boolean(
    cfg.AGENT_PRIVATE_KEY &&
      (cfg.PIMLICO_API_KEY || cfg.BUNDLER_RPC_URL || cfg.PAYMASTER_RPC_URL)
  );
}

/**
 * Submit a gas-sponsored call through a Safe smart account (ERC-4337).
 * Owner EOA signs; Safe submits UserOps; Pimlico paymaster sponsors gas.
 * Counterfactual Safe deploys automatically on first sponsored UserOp.
 */
export async function sendSponsoredTransaction(params: {
  to: Address;
  data: Hex;
  value?: bigint;
}): Promise<SponsoredSendResult> {
  const privateKey = config.AGENT_PRIVATE_KEY as Hex | '';
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY is required for sponsored Safe execution');
  }
  const pimlicoUrl = resolvePimlicoRpcUrl();
  if (!pimlicoUrl) {
    throw new Error(
      'PIMLICO_API_KEY or BUNDLER_RPC_URL/PAYMASTER_RPC_URL required for sponsorship'
    );
  }

  const chain = resolveBaseChain();
  const rpcUrl = config.rpcUrls[0] ?? config.BASE_RPC_URL;

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 30_000 }),
  });

  const signer = privateKeyToAccount(privateKey);
  const pimlicoClient = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
  });

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [signer],
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
    version: '1.4.1',
  });

  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain,
    bundlerTransport: http(pimlicoUrl),
    // Pimlico client exposes getPaymasterData / getPaymasterStubData.
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () =>
        (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  const txHash = await smartAccountClient.sendTransaction({
    to: params.to,
    data: params.data,
    value: params.value ?? 0n,
  });

  let blockNumber: string | undefined;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    blockNumber = receipt.blockNumber.toString();
  } catch {
    // Receipt wait is best-effort; hash is still valid for polling.
  }

  return {
    txHash,
    smartAccountAddress: safeAccount.address,
    ownerAddress: signer.address,
    blockNumber,
  };
}

/** Resolve counterfactual Safe address without broadcasting. */
export async function getSmartAccountAddress(): Promise<Address | null> {
  if (!config.AGENT_PRIVATE_KEY) return null;
  try {
    const chain = resolveBaseChain();
    const publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrls[0] ?? config.BASE_RPC_URL, {
        timeout: 15_000,
      }),
    });
    const signer = privateKeyToAccount(config.AGENT_PRIVATE_KEY as Hex);
    const safeAccount = await toSafeSmartAccount({
      client: publicClient,
      owners: [signer],
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
      version: '1.4.1',
    });
    return safeAccount.address;
  } catch {
    return null;
  }
}
