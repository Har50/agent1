/**
 * Fastify preHandler: Tenderly dry-run before UserOp construction.
 * Halt with HTTP 422 on revert / unexpected drain.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  simulateOnTenderly,
  simulateTransaction,
  type SimulationParams,
  type SimulationResult,
} from '../services/tenderly.js';
import { config } from '../config/env.js';
import { resolveBaseChain } from '../services/safeAccount.js';
import { getSmartAccountAddress } from '../services/safeAccount.js';
import { getAgentAddress } from '../services/userOp.js';

export type { SimulationParams, SimulationResult };
export { simulateTransaction };

export const intentExecuteBodySchema = z.object({
  networkId: z.string().optional(),
  fromAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
  targetAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  calldata: z.string().regex(/^0x[0-9a-fA-F]*$/),
  valueWei: z.string().regex(/^\d+$/).optional().default('0'),
  maxAllowedDrainUSD: z.number().positive().optional(),
  agentId: z.string().min(1).max(128).optional().default('execute-agent'),
  dryRun: z.boolean().optional().default(false),
});

export type IntentExecuteBody = z.infer<typeof intentExecuteBodySchema>;

declare module 'fastify' {
  interface FastifyRequest {
    simulationResult?: SimulationResult;
    intentExecute?: IntentExecuteBody & { fromAddress: `0x${string}` };
  }
}

export async function verifySimulationHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = intentExecuteBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: 'Bad Request',
      message:
        'Missing or invalid fields: targetAddress, calldata (fromAddress optional — derived from Safe)',
      details: parsed.error.flatten(),
    });
  }

  const body = parsed.data;
  const networkId = body.networkId ?? String(resolveBaseChain().id);

  let fromAddress = body.fromAddress as `0x${string}` | undefined;
  if (!fromAddress) {
    fromAddress =
      ((await getSmartAccountAddress()) as `0x${string}` | null) ??
      getAgentAddress() ??
      undefined;
  }
  if (!fromAddress) {
    return reply.status(400).send({
      error: 'Bad Request',
      message:
        'fromAddress required (or set AGENT_PRIVATE_KEY to derive Safe/EOA)',
    });
  }

  const targetAddress = body.targetAddress as `0x${string}`;
  const calldata = body.calldata as `0x${string}`;
  const valueWei = body.valueWei ?? '0';

  request.intentExecute = {
    ...body,
    fromAddress,
    networkId,
  };

  // Mock mode: skip remote Tenderly, attach a synthetic pass.
  if (config.EXECUTION_MODE === 'mock') {
    request.simulationResult = {
      success: true,
      gasUsed: 65000,
      balanceChanges: [],
    };
    request.log.info('Mock mode — skipping Tenderly, synthetic PASS attached');
    return;
  }

  if (!config.tenderlyEnabled) {
    if (config.TENDERLY_REQUIRED) {
      return reply.status(422).send({
        error: 'Simulation Failed',
        code: 'TENDERLY_REQUIRED',
        reason: 'Tenderly credentials missing but TENDERLY_REQUIRED=true',
      });
    }
    // Soft-pass when Tenderly optional — route may still use viem later.
    request.simulationResult = {
      success: true,
      gasUsed: undefined,
      balanceChanges: [],
      errorMessage: 'Tenderly not configured — soft pass',
    };
    request.log.warn('Tenderly not configured — proceeding without dry-run');
    return;
  }

  try {
    request.log.info(
      { from: fromAddress, to: targetAddress, networkId },
      'Simulating transaction on Tenderly...'
    );

    const result = await simulateOnTenderly({
      networkId,
      from: fromAddress,
      to: targetAddress,
      input: calldata,
      value: valueWei,
    });

    if (!result.success) {
      request.log.warn(
        { reason: result.errorMessage },
        'Transaction simulation REVERTED'
      );
      return reply.status(422).send({
        error: 'Simulation Failed',
        code: 'TRANSACTION_REVERTED',
        reason:
          result.errorMessage ||
          'Contract execution reverted during simulation.',
        details: { gasUsed: result.gasUsed },
      });
    }

    const maxDrain =
      body.maxAllowedDrainUSD ?? config.TENDERLY_MAX_DRAIN_USDC;
    const drainUsd = estimateDrainUsd(result);
    if (drainUsd > maxDrain) {
      request.log.warn(
        { drainUsd, maxDrain },
        'Simulation blocked — unexpected balance drain'
      );
      return reply.status(422).send({
        error: 'Simulation Failed',
        code: 'BALANCE_DRAIN',
        reason: `Unauthorized balance drain: ~$${drainUsd.toFixed(2)} > max $${maxDrain}`,
        details: {
          gasUsed: result.gasUsed,
          balanceChanges: result.balanceChanges,
        },
      });
    }

    request.simulationResult = result;
    request.log.info(
      { gasUsed: result.gasUsed },
      'Tenderly simulation PASSED successfully'
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    request.log.error({ err }, 'Failed to complete transaction simulation');
    return reply.status(500).send({
      error: 'Simulation Service Error',
      message: message || 'Failed to reach simulation provider',
    });
  }
}

function estimateDrainUsd(result: SimulationResult): number {
  let max = 0;
  for (const bc of result.balanceChanges ?? []) {
    const dollar = bc.dollarValue ? Number(bc.dollarValue) : NaN;
    if (Number.isFinite(dollar) && dollar < 0) {
      max = Math.max(max, Math.abs(dollar));
    }
    const dir = (bc.direction || '').toLowerCase();
    if (dir.includes('out') && bc.dollarValue) {
      const d = Math.abs(Number(bc.dollarValue));
      if (Number.isFinite(d)) max = Math.max(max, d);
    }
  }
  return max;
}
