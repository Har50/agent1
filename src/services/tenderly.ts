/**
 * Tenderly simulation service — dry-runs txs on Tenderly's virtual EVM
 * before permissionless.js constructs / signs a UserOperation.
 *
 * Docs: https://docs.tenderly.co/simulations
 */
import { config } from '../config/env.js';
import type { ResolvedCall } from './intentResolver.js';
import type { SimulationOutcome } from './simulator.js';
import { mockSimulate, simulateCall } from './simulator.js';
import { resolveBaseChain } from './safeAccount.js';

export interface SimulationRequest {
  /** e.g. "8453" Base mainnet, "84532" Base Sepolia */
  networkId: string;
  /** Smart Account (Safe) or EOA address */
  from: `0x${string}`;
  /** Target contract */
  to: `0x${string}`;
  /** Encoded function calldata */
  input: `0x${string}`;
  /** Wei value as string (default "0") */
  value?: string;
  /** Persist sim in Tenderly dashboard (default true in live) */
  save?: boolean;
}

export interface BalanceChange {
  address: string;
  dollarValue?: string;
  amount: string;
  direction?: string;
}

export interface SimulationResult {
  success: boolean;
  errorMessage?: string;
  gasUsed?: number;
  balanceChanges?: BalanceChange[];
}

export type SafetyVerdict =
  | {
      ok: true;
      simulation: SimulationOutcome;
      tenderly?: SimulationResult;
      provider: 'tenderly' | 'viem' | 'mock';
    }
  | {
      ok: false;
      reason: string;
      code: 'TRANSACTION_REVERTED' | 'BALANCE_DRAIN' | 'TARGET_MISMATCH' | 'TENDERLY_REQUIRED';
      simulation: SimulationOutcome;
      tenderly?: SimulationResult;
      provider: 'tenderly' | 'viem' | 'mock';
      httpStatus: 422;
    };

type TenderlyAssetChange = {
  address?: string;
  token_info?: { standard?: string; contract_address?: string; symbol?: string };
  raw_amount?: string;
  amount?: string;
  dollar_value?: string;
  direction?: string;
};

type TenderlySimulateResponse = {
  simulation?: {
    status?: boolean;
    gas_used?: number;
    error_message?: string;
  };
  transaction?: {
    transaction_info?: {
      asset_changes?: TenderlyAssetChange[];
      balance_changes?: TenderlyAssetChange[];
      call_trace?: { error?: string };
    };
  };
  error?: { message?: string };
};

export function isTenderlyConfigured(): boolean {
  return config.tenderlyEnabled;
}

/**
 * Call Tenderly REST simulate API (Node 22 native fetch).
 */
export async function simulateOnTenderly(
  params: SimulationRequest
): Promise<SimulationResult> {
  const accessKey = config.TENDERLY_ACCESS_KEY;
  const account = config.TENDERLY_ACCOUNT_SLUG;
  const project = config.TENDERLY_PROJECT_SLUG;

  if (!accessKey || !account || !project) {
    throw new Error('Missing required Tenderly environment variables.');
  }

  const url = `https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`;

  const payload = {
    network_id: params.networkId,
    from: params.from.toLowerCase(),
    to: params.to.toLowerCase(),
    input: params.input,
    value: params.value || '0',
    save: params.save ?? true,
    save_if_fails: true,
    simulation_type: 'full',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Key': accessKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tenderly API Error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as TenderlySimulateResponse;
  const isSuccess = data.simulation?.status === true;
  const errorMessage =
    data.simulation?.error_message ||
    data.transaction?.transaction_info?.call_trace?.error ||
    (isSuccess ? undefined : 'Execution reverted on-chain');

  const rawChanges =
    data.transaction?.transaction_info?.balance_changes ??
    data.transaction?.transaction_info?.asset_changes ??
    [];

  const balanceChanges: BalanceChange[] = rawChanges.map((bc) => ({
    address:
      bc.address ||
      bc.token_info?.contract_address ||
      bc.token_info?.symbol ||
      'unknown',
    dollarValue: bc.dollar_value,
    amount: bc.raw_amount || bc.amount || '0',
    direction: bc.direction,
  }));

  return {
    success: isSuccess,
    errorMessage,
    gasUsed: data.simulation?.gas_used,
    balanceChanges,
  };
}

/** Adapter used by the intent pipeline (ResolvedCall → SimulationOutcome). */
export async function simulateWithTenderly(
  call: ResolvedCall,
  from: `0x${string}`
): Promise<SimulationOutcome> {
  const chain = resolveBaseChain();
  const result = await simulateOnTenderly({
    networkId: String(chain.id),
    from,
    to: call.to,
    input: call.data,
    value: call.value.toString(),
    save: config.NODE_ENV === 'production',
  });
  return tenderlyToOutcome(result);
}

export function tenderlyToOutcome(result: SimulationResult): SimulationOutcome {
  return {
    success: result.success,
    gasUsed: result.gasUsed?.toString(),
    revertReason: result.success
      ? undefined
      : (result.errorMessage ?? 'Tenderly simulation failed'),
    balanceChanges: (result.balanceChanges ?? []).map((bc) => {
      const dir = (bc.direction || '').toLowerCase();
      const out = dir === 'out' || dir === 'transfer_out' || dir.includes('out');
      const dollar = bc.dollarValue ? Number(bc.dollarValue) : NaN;
      const amount = Number(bc.amount);
      const magnitude = Number.isFinite(dollar)
        ? Math.abs(dollar)
        : Number.isFinite(amount)
          ? Math.abs(amount)
          : 0;
      return {
        token: bc.address,
        delta: `${out || (Number.isFinite(dollar) && dollar < 0) ? '-' : '+'}${magnitude}`,
      };
    }),
  };
}

/**
 * Run Tenderly (when configured) or viem estimateGas, then enforce drain/revert policies.
 */
export async function runPreExecutionSafety(
  call: ResolvedCall,
  from: `0x${string}`,
  opts: { dryRun: boolean; mode: string }
): Promise<SafetyVerdict> {
  if (opts.mode === 'mock') {
    const simulation = mockSimulate(call);
    return { ok: true, simulation, provider: 'mock' };
  }

  if (isTenderlyConfigured()) {
    try {
      const tenderly = await simulateOnTenderly({
        networkId: String(resolveBaseChain().id),
        from,
        to: call.to,
        input: call.data,
        value: call.value.toString(),
      });
      const simulation = tenderlyToOutcome(tenderly);
      return enforceSafetyPolicy(simulation, call, 'tenderly', tenderly);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: message,
        code: 'TRANSACTION_REVERTED',
        simulation: { success: false, revertReason: message },
        provider: 'tenderly',
        httpStatus: 422,
      };
    }
  }

  if (config.TENDERLY_REQUIRED) {
    return {
      ok: false,
      reason:
        'TENDERLY_REQUIRED=true but Tenderly credentials are missing (ACCESS_KEY / ACCOUNT / PROJECT)',
      code: 'TENDERLY_REQUIRED',
      simulation: { success: false, revertReason: 'Tenderly not configured' },
      provider: 'tenderly',
      httpStatus: 422,
    };
  }

  const simulation = await simulateCall(call, from);
  return enforceSafetyPolicy(simulation, call, 'viem');
}

function enforceSafetyPolicy(
  simulation: SimulationOutcome,
  call: ResolvedCall,
  provider: 'tenderly' | 'viem' | 'mock',
  tenderly?: SimulationResult
): SafetyVerdict {
  if (!simulation.success) {
    return {
      ok: false,
      reason: simulation.revertReason ?? 'Simulation reverted',
      code: 'TRANSACTION_REVERTED',
      simulation,
      tenderly,
      provider,
      httpStatus: 422,
    };
  }

  const maxDrain =
    typeof (call.intent.metadata as { maxAllowedDrainUSD?: number } | undefined)
      ?.maxAllowedDrainUSD === 'number'
      ? (call.intent.metadata as { maxAllowedDrainUSD: number }).maxAllowedDrainUSD
      : config.TENDERLY_MAX_DRAIN_USDC;

  const drain = estimateUsdDrain(simulation, call, tenderly);
  if (drain > maxDrain) {
    return {
      ok: false,
      reason: `Unauthorized balance drain detected: ~${drain.toFixed(2)} USD > max ${maxDrain}`,
      code: 'BALANCE_DRAIN',
      simulation,
      tenderly,
      provider,
      httpStatus: 422,
    };
  }

  if (
    call.intent.target &&
    call.to.toLowerCase() !== call.intent.target.toLowerCase()
  ) {
    return {
      ok: false,
      reason: `Target mismatch: call.to ${call.to} != intent.target ${call.intent.target}`,
      code: 'TARGET_MISMATCH',
      simulation,
      tenderly,
      provider,
      httpStatus: 422,
    };
  }

  return { ok: true, simulation, tenderly, provider };
}

function estimateUsdDrain(
  simulation: SimulationOutcome,
  call: ResolvedCall,
  tenderly?: SimulationResult
): number {
  let maxOut = 0;
  for (const bc of tenderly?.balanceChanges ?? []) {
    const dollar = bc.dollarValue ? Number(bc.dollarValue) : NaN;
    if (Number.isFinite(dollar) && dollar < 0 && Math.abs(dollar) > maxOut) {
      maxOut = Math.abs(dollar);
    }
    const dir = (bc.direction || '').toLowerCase();
    if (dir.includes('out')) {
      const amt = Number(bc.amount);
      if (Number.isFinite(amt) && Math.abs(amt) > maxOut) maxOut = Math.abs(amt);
    }
  }
  for (const change of simulation.balanceChanges ?? []) {
    if (change.delta.startsWith('-')) {
      const n = Number(change.delta.slice(1));
      if (Number.isFinite(n) && n > maxOut) maxOut = n;
    }
  }
  if (maxOut > 0) return maxOut;
  if (call.intent.amountIn) {
    const n = Number(call.intent.amountIn);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
