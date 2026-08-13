import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  EXECUTION_MODE: z.enum(['live', 'simulate', 'mock']).default('mock'),
  BASE_NETWORK: z.enum(['base', 'baseSepolia']).default('base'),
  /** Explicit chain id (8453 | 84532). When set, overrides BASE_NETWORK. */
  CHAIN_ID: z.coerce.number().optional(),
  BASE_RPC_URL: z.string().optional().default(''),
  BASE_RPC_URLS: z.string().optional().default(''),
  /** Pimlico API key — builds bundler/paymaster URL when BUNDLER_RPC_URL unset. */
  PIMLICO_API_KEY: z.string().optional().default(''),
  BUNDLER_RPC_URL: z.string().optional().default(''),
  PAYMASTER_RPC_URL: z.string().optional().default(''),
  PAYMASTER_POLICY_ID: z.string().optional().default(''),
  AGENT_PRIVATE_KEY: z
    .string()
    .regex(/^$|^0x[0-9a-fA-F]{64}$/)
    .optional()
    .default(''),
  /** Require Tenderly success before live broadcast when credentials are set. */
  TENDERLY_ACCESS_KEY: z.string().optional().default(''),
  TENDERLY_ACCOUNT_SLUG: z.string().optional().default(''),
  TENDERLY_PROJECT_SLUG: z.string().optional().default(''),
  TENDERLY_REQUIRED: z
    .enum(['true', 'false', '0', '1'])
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /** Max absolute USDC-equivalent drain allowed by Tenderly balance delta checks. */
  TENDERLY_MAX_DRAIN_USDC: z.coerce.number().positive().default(500),
  /** ZeroDev Kernel / ERC-7579 session keys */
  ZERODEV_PROJECT_ID: z.string().optional().default(''),
  ZERODEV_BUNDLER_RPC: z.string().optional().default(''),
  ZERODEV_PAYMASTER_RPC: z.string().optional().default(''),
  SESSION_KEY_MODE: z.enum(['off', 'db', 'zerodev']).default('db'),
  /** Default session key: max USDC per call (6 decimals) + TTL hours */
  SESSION_KEY_MAX_USDC: z.coerce.number().positive().default(50),
  SESSION_KEY_TTL_HOURS: z.coerce.number().positive().default(24),
  DATABASE_URL: z.string().optional().default(''),
  REDIS_URL: z.string().optional().default(''),
  API_KEYS: z.string().default('dev-agent-key'),
  DEFAULT_MAX_SPEND_USDC: z.coerce.number().positive().default(100),
  DEFAULT_ALLOWED_TARGETS: z.string().optional().default(''),
  /** Public base URL for hosted MCP / production docs */
  PUBLIC_BASE_URL: z.string().optional().default(''),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
});

export type AppConfig = z.infer<typeof envSchema> & {
  apiKeys: Set<string>;
  rpcUrls: string[];
  allowedTargets: Set<string>;
  tenderlyEnabled: boolean;
  chainId: 8453 | 84532;
};

function parseList(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultRpc(network: 'base' | 'baseSepolia'): string {
  return network === 'baseSepolia'
    ? 'https://sepolia.base.org'
    : 'https://mainnet.base.org';
}

function resolveNetwork(
  chainId: number | undefined,
  baseNetwork: 'base' | 'baseSepolia'
): { network: 'base' | 'baseSepolia'; chainId: 8453 | 84532 } {
  if (chainId === 84532) return { network: 'baseSepolia', chainId: 84532 };
  if (chainId === 8453) return { network: 'base', chainId: 8453 };
  return {
    network: baseNetwork,
    chainId: baseNetwork === 'baseSepolia' ? 84532 : 8453,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const { network, chainId } = resolveNetwork(parsed.CHAIN_ID, parsed.BASE_NETWORK);
  const primary = parsed.BASE_RPC_URL || defaultRpc(network);
  const rpcUrls = [...parseList(parsed.BASE_RPC_URLS), primary].filter(
    (u, i, arr) => arr.indexOf(u) === i
  );

  const tenderlyEnabled = Boolean(
    parsed.TENDERLY_ACCESS_KEY &&
      parsed.TENDERLY_ACCOUNT_SLUG &&
      parsed.TENDERLY_PROJECT_SLUG
  );

  return {
    ...parsed,
    BASE_NETWORK: network,
    BASE_RPC_URL: primary,
    chainId,
    rpcUrls,
    apiKeys: new Set(parseList(parsed.API_KEYS)),
    allowedTargets: new Set(
      parseList(parsed.DEFAULT_ALLOWED_TARGETS).map((a) => a.toLowerCase())
    ),
    tenderlyEnabled,
  };
}

export const config = loadConfig();
