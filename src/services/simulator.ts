import { getBasePublicClient } from '../config/baseRpc.js';
import type { ResolvedCall } from './intentResolver.js';

export type SimulationOutcome = {
  success: boolean;
  gasUsed?: string;
  revertReason?: string;
  balanceChanges?: { token: string; delta: string }[];
};

/**
 * Dry-run via viem.simulateContract-style eth_call.
 * Optionally extend with Tenderly when credentials are configured.
 */
export async function simulateCall(
  call: ResolvedCall,
  from: `0x${string}`
): Promise<SimulationOutcome> {
  const client = getBasePublicClient();
  try {
    const gas = await client.estimateGas({
      account: from,
      to: call.to,
      data: call.data,
      value: call.value,
    });
    return {
      success: true,
      gasUsed: gas.toString(),
      balanceChanges: estimateBalanceHints(call),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      revertReason: message.slice(0, 500),
    };
  }
}

function estimateBalanceHints(
  call: ResolvedCall
): { token: string; delta: string }[] {
  const hints: { token: string; delta: string }[] = [];
  if (call.intent.tokenIn && (call.intent.amountIn || call.intent.amountInWei)) {
    hints.push({
      token: call.intent.tokenIn,
      delta: `-${call.intent.amountIn ?? call.intent.amountInWei}`,
    });
  }
  if (call.intent.kind === 'swap' && call.intent.tokenOut) {
    hints.push({
      token: call.intent.tokenOut,
      delta: '+estimated',
    });
  }
  return hints;
}

/** Deterministic mock simulation for CI / offline demos. */
export function mockSimulate(call: ResolvedCall): SimulationOutcome {
  return {
    success: true,
    gasUsed: '185000',
    balanceChanges: estimateBalanceHints(call),
  };
}
