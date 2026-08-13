import {
  createWalletClient,
  type Address,
  type Hex,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config/env.js';
import { createBaseTransport } from '../config/baseRpc.js';
import type { ResolvedCall } from './intentResolver.js';
import type { ExecuteResult } from '../schemas/intent.js';
import {
  canUseSponsoredSafe,
  getSmartAccountAddress,
  resolveBaseChain,
  sendSponsoredTransaction,
} from './safeAccount.js';
import { runPreExecutionSafety } from './tenderly.js';

export type UserOpSubmission = {
  userOpHash: Hex;
  txHash?: Hex;
  smartAccountAddress?: Address;
};

/**
 * Build and submit an ERC-4337 UserOperation.
 * Preferred path: Safe Smart Account + Pimlico paymaster (gasless for the agent).
 * Pre-broadcast: Tenderly (or viem) safety gate.
 */
export async function executeUserOperation(
  call: ResolvedCall,
  intentId: string,
  opts: { dryRun: boolean }
): Promise<ExecuteResult> {
  const mode = config.EXECUTION_MODE;
  const account = getAgentAccount();

  const smartAccount =
    mode !== 'mock' && canUseSponsoredSafe()
      ? await getSmartAccountAddress()
      : null;
  const from = (smartAccount ?? account?.address ??
    '0x0000000000000000000000000000000000000001') as Address;

  const safety = await runPreExecutionSafety(call, from, {
    dryRun: opts.dryRun,
    mode,
  });

  if (!safety.ok) {
    return {
      status: 'rejected',
      intentId,
      simulation: safety.simulation,
      error: safety.reason,
      mode,
      safetyProvider: safety.provider,
    };
  }

  if (opts.dryRun || mode === 'simulate' || mode === 'mock') {
    return {
      status: mode === 'mock' && !opts.dryRun ? 'submitted' : 'simulated',
      intentId,
      userOpHash: mode === 'mock' ? mockUserOpHash(intentId) : undefined,
      txHash:
        mode === 'mock' && !opts.dryRun ? mockTxHash(intentId) : undefined,
      simulation: safety.simulation,
      mode: mode === 'mock' ? 'mock' : mode === 'simulate' ? 'simulate' : mode,
      safetyProvider: safety.provider,
    };
  }

  if (!account) {
    return {
      status: 'failed',
      intentId,
      simulation: safety.simulation,
      error: 'AGENT_PRIVATE_KEY required for live execution',
      mode: 'live',
      safetyProvider: safety.provider,
    };
  }

  // Production path: Safe + Pimlico sponsored UserOperation.
  if (canUseSponsoredSafe()) {
    try {
      const sponsored = await sendSponsoredTransaction({
        to: call.to,
        data: call.data,
        value: call.value,
      });
      return {
        status: sponsored.blockNumber ? 'confirmed' : 'submitted',
        intentId,
        txHash: sponsored.txHash,
        userOpHash: sponsored.txHash,
        simulation: safety.simulation,
        mode: 'live',
        safetyProvider: safety.provider,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: 'failed',
        intentId,
        simulation: safety.simulation,
        error: `Sponsored Safe UserOp failed: ${message}`,
        mode: 'live',
        safetyProvider: safety.provider,
      };
    }
  }

  if (config.BUNDLER_RPC_URL) {
    const submitted = await submitViaBundler(call, from);
    return {
      status: 'submitted',
      intentId,
      userOpHash: submitted.userOpHash,
      txHash: submitted.txHash,
      simulation: safety.simulation,
      mode: 'live',
      safetyProvider: safety.provider,
    };
  }

  const wallet = getWalletClient(account);
  const txHash = await wallet.sendTransaction({
    account,
    to: call.to,
    data: call.data,
    value: call.value,
    chain: resolveBaseChain(),
  });

  return {
    status: 'submitted',
    intentId,
    txHash,
    simulation: safety.simulation,
    mode: 'live',
    safetyProvider: safety.provider,
  };
}

type AgentAccount = ReturnType<typeof privateKeyToAccount>;

function getAgentAccount(): AgentAccount | null {
  if (!config.AGENT_PRIVATE_KEY) return null;
  return privateKeyToAccount(config.AGENT_PRIVATE_KEY as Hex);
}

function getWalletClient(account: AgentAccount): WalletClient {
  return createWalletClient({
    account,
    chain: resolveBaseChain(),
    transport: createBaseTransport(),
  });
}

async function submitViaBundler(
  call: ResolvedCall,
  sender: Address
): Promise<UserOpSubmission> {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_sendUserOperation',
    params: [
      {
        sender,
        nonce: '0x0',
        callData: call.data,
        callGasLimit: '0x30d40',
        verificationGasLimit: '0x30d40',
        preVerificationGas: '0x5208',
        maxFeePerGas: '0x59682f00',
        maxPriorityFeePerGas: '0x59682f00',
        signature: '0x',
        paymasterAndData: '0x',
      },
      '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    ],
  };

  const res = await fetch(config.BUNDLER_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (json.error?.message) {
    throw new Error(json.error.message);
  }
  if (!json.result) {
    throw new Error('Bundler returned empty userOpHash');
  }
  return { userOpHash: json.result as Hex };
}

function mockUserOpHash(intentId: string): Hex {
  const pad = intentId.replace(/[^0-9a-f]/gi, '').padEnd(64, '0').slice(0, 64);
  return `0x${pad}` as Hex;
}

function mockTxHash(intentId: string): Hex {
  const pad = intentId.replace(/[^0-9a-f]/gi, '').padStart(64, 'a').slice(0, 64);
  return `0x${pad}` as Hex;
}

export function getAgentAddress(): Address | null {
  const account = getAgentAccount();
  return account?.address ?? null;
}
