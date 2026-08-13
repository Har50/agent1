/**
 * Base chain public client with ordered RPC failover.
 */
import { createPublicClient, fallback, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { config } from './env.js';

/** Minimal surface used by the simulator (avoids giant viem declaration emit). */
export type BaseGasClient = {
  estimateGas: (args: {
    account: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
  }) => Promise<bigint>;
};

let cachedClient: BaseGasClient | null = null;

export function createBaseTransport() {
  return fallback(
    config.rpcUrls.map((url) =>
      http(url, {
        timeout: 22_000,
        retryCount: 1,
        retryDelay: 400,
      })
    ),
    { rank: false, retryCount: 2 }
  );
}

export function getBasePublicClient(): BaseGasClient {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: config.chainId === 84532 ? baseSepolia : base,
      transport: createBaseTransport(),
    });
  }
  return cachedClient;
}

export function resetBasePublicClient(): void {
  cachedClient = null;
}

export const BASE_CHAIN_ID = base.id;
export const BASE_SEPOLIA_CHAIN_ID = baseSepolia.id;

/** USDC on Base mainnet */
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
/** USDC on Base Sepolia */
export const BASE_SEPOLIA_USDC =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

export function getUsdcAddress(): `0x${string}` {
  return config.chainId === 84532 ? BASE_SEPOLIA_USDC : BASE_USDC;
}

export const UNISWAP_V3_ROUTER =
  '0x2626664c2603336E57B271c5C0b26F421741e481' as const;
