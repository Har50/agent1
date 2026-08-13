/**
 * Intent execute route — Tenderly preHandler then Safe/Pimlico UserOp.
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  intentExecuteBodySchema,
  verifySimulationHook,
} from '../middleware/simulateHook.js';
import { config } from '../config/env.js';
import { executeUserOperation } from '../services/userOp.js';
import type { ResolvedCall } from '../services/intentResolver.js';
import { newIntentId, recordTransaction } from '../db/repository.js';
import type { Intent } from '../schemas/intent.js';
import { enforceSessionKeyScope } from '../services/sessionKeys.js';

export const intentExecuteRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/v1/intent/execute',
    {
      preHandler: [verifySimulationHook],
    },
    async (request, reply) => {
      const body = request.intentExecute;
      const simulation = request.simulationResult;

      if (!body || !simulation) {
        return reply.status(500).send({
          error: 'Simulation context missing',
          message: 'preHandler did not attach simulationResult',
        });
      }

      request.log.info(
        'Tenderly simulation PASSED — proceeding to UserOperation...'
      );

      const rawBody = request.body as { sessionKeyId?: string };
      const intent: Intent = {
        kind: 'custom',
        agentId: body.agentId ?? 'execute-agent',
        sessionKeyId: rawBody?.sessionKeyId,
        chainId: (Number(body.networkId) === 84532 ? 84532 : 8453) as
          | 8453
          | 84532,
        target: body.targetAddress as `0x${string}`,
        data: body.calldata as `0x${string}`,
        valueWei: body.valueWei ?? '0',
        slippageBps: 50,
        dryRun: body.dryRun ?? false,
        metadata: {
          maxAllowedDrainUSD: body.maxAllowedDrainUSD,
          source: 'intent/execute',
        },
      };

      const call: ResolvedCall = {
        to: body.targetAddress as `0x${string}`,
        data: body.calldata as `0x${string}`,
        value: BigInt(body.valueWei ?? '0'),
        intent,
      };

      const sk = await enforceSessionKeyScope(
        intent,
        call,
        intent.sessionKeyId
      );
      if (!sk.ok) {
        return reply.status(422).send({
          error: 'Session Key Denied',
          code: 'SESSION_KEY_VIOLATION',
          reason: sk.reason,
        });
      }

      const intentId = newIntentId();
      const result = await executeUserOperation(call, intentId, {
        dryRun: body.dryRun ?? false,
      });

      await recordTransaction(intent, intentId, result, sk.scope?.id);

      if (result.status === 'rejected') {
        return reply.status(422).send({
          error: 'Simulation Failed',
          code: 'TRANSACTION_REVERTED',
          reason: result.error,
          details: { gasUsed: result.simulation?.gasUsed, intentId },
        });
      }

      if (result.status === 'failed') {
        return reply.status(502).send({
          error: 'Execution Failed',
          reason: result.error,
          intentId,
          simulationSummary: {
            gasEstimated: simulation.gasUsed,
            status: 'PASSED',
          },
        });
      }

      return reply.status(200).send({
        status: 'SUCCESS',
        message:
          result.status === 'simulated' || body.dryRun
            ? 'Dry-run passed; UserOp not broadcast.'
            : 'UserOp submitted safely after successful dry-run.',
        intentId,
        userOpHash: result.userOpHash,
        txHash: result.txHash,
        mode: result.mode ?? config.EXECUTION_MODE,
        sessionKeyId: sk.scope?.id,
        simulationSummary: {
          gasEstimated: simulation.gasUsed ?? result.simulation?.gasUsed,
          status: 'PASSED',
          balanceChanges: simulation.balanceChanges,
        },
      });
    }
  );

  // Schema-only helper for OpenAPI / tests
  app.post('/v1/intent/simulate-only', {
    preHandler: [verifySimulationHook],
    handler: async (request, reply) => {
      const parsed = intentExecuteBodySchema.safeParse(request.body);
      return reply.send({
        status: 'PASSED',
        simulation: request.simulationResult,
        echo: parsed.success ? parsed.data : null,
      });
    },
  });
};
