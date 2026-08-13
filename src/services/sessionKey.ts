/**
 * ERC-7579 / ZeroDev Kernel session key creator.
 *
 * Root owner issues a time-bound, spend-capped, target-whitelisted session key
 * for AI agents. DB scopes are always persisted; on-chain validator is built
 * when SESSION_KEY_MODE=zerodev.
 */
import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import {
  ParamOperator,
  signerToSessionKeyValidator,
} from '@zerodev/session-key';
import { config } from '../config/env.js';
import { getUsdcAddress } from '../config/baseRpc.js';
import { resolveBaseChain } from './safeAccount.js';
import {
  upsertSessionKeyScope,
} from '../db/repository.js';
import type { SessionKeyScope } from '../schemas/sessionKey.js';
import { provisionZeroDevSessionHint } from './sessionKeys.js';

export type CreatedSessionKey = {
  sessionPrivateKey: Hex;
  sessionKeyAddress: Address;
  scope: SessionKeyScope;
  /** Serialized hint — validator plugin is not JSON-serializable */
  validatorReady: boolean;
  permissions: {
    target: Address;
    functionName: 'transfer';
    maxAmountWei: string;
    validUntil: number;
    validAfter: number;
  };
};

export type CreateSessionKeyOptions = {
  agentId: string;
  sessionId?: string;
  /** Override target (default: network USDC) */
  target?: Address;
  /** Max USDC per call (human units, 6 decimals) */
  maxUsdc?: number;
  /** TTL in hours (default SESSION_KEY_TTL_HOURS) */
  ttlHours?: number;
  /** Persist generated private key into scope.metadata (dev only — never in prod) */
  persistPrivateKey?: boolean;
};

/**
 * Generate an ephemeral AI agent session key with ZeroDev permissions:
 * - valid 24h (configurable)
 * - USDC.transfer only
 * - amount ≤ maxUsdc (default 50)
 * - native valueLimit = 0
 */
export async function createAgentSessionKey(
  opts: CreateSessionKeyOptions
): Promise<CreatedSessionKey> {
  const maxUsdc = opts.maxUsdc ?? config.SESSION_KEY_MAX_USDC;
  const ttlHours = opts.ttlHours ?? config.SESSION_KEY_TTL_HOURS;
  const target = (opts.target ?? getUsdcAddress()) as Address;
  const maxAmountWei = BigInt(Math.floor(maxUsdc * 1e6));

  const now = Math.floor(Date.now() / 1000);
  const validAfter = now;
  const validUntil = now + Math.floor(ttlHours * 3600);

  const sessionPrivateKey = generatePrivateKey();
  const sessionKeySigner = privateKeyToAccount(sessionPrivateKey);

  const chain = resolveBaseChain();
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrls[0] ?? config.BASE_RPC_URL),
  });

  const usdcAbi = parseAbi([
    'function transfer(address to, uint256 amount)',
  ]);

  let validatorReady = false;
  if (config.SESSION_KEY_MODE === 'zerodev') {
    try {
      await signerToSessionKeyValidator(publicClient, {
        signer: sessionKeySigner,
        entryPoint: getEntryPoint('0.7'),
        kernelVersion: KERNEL_V3_1,
        validatorData: {
          validAfter,
          validUntil,
          permissions: [
            {
              target,
              // Cannot send native ETH
              valueLimit: 0n,
              abi: usdcAbi,
              functionName: 'transfer',
              args: [
                null, // any recipient
                {
                  operator: ParamOperator.LESS_THAN_OR_EQUAL,
                  value: maxAmountWei,
                },
              ],
            },
          ],
        },
      });
      validatorReady = true;
    } catch (err) {
      // Still persist DB scope — on-chain install may need Kernel account setup.
      console.warn(
        '[sessionKey] ZeroDev validator build failed — DB scope only:',
        err instanceof Error ? err.message : err
      );
    }
  }

  const id = `sk_${sessionKeySigner.address.slice(2, 10)}_${now}`;
  let scope: SessionKeyScope = {
    id,
    agentId: opts.agentId,
    sessionId: opts.sessionId,
    publicKey: sessionKeySigner.address,
    maxSpendUsdc: maxUsdc,
    spentUsdc: 0,
    spendWindowSeconds: Math.floor(ttlHours * 3600),
    windowStartedAt: new Date().toISOString(),
    allowedTargets: [target],
    // transfer(address,uint256)
    allowedSelectors: ['0xa9059cbb'],
    expiresAt: new Date(validUntil * 1000).toISOString(),
    active: true,
    metadata: {
      provisioner: validatorReady ? 'zerodev' : 'db',
      maxAmountWei: maxAmountWei.toString(),
      validAfter,
      validUntil,
      ...(opts.persistPrivateKey && config.NODE_ENV !== 'production'
        ? { sessionPrivateKey }
        : {}),
    },
  };

  scope = await provisionZeroDevSessionHint(scope);
  scope = await upsertSessionKeyScope(scope);

  return {
    sessionPrivateKey,
    sessionKeyAddress: sessionKeySigner.address,
    scope,
    validatorReady,
    permissions: {
      target,
      functionName: 'transfer',
      maxAmountWei: maxAmountWei.toString(),
      validUntil,
      validAfter,
    },
  };
}
