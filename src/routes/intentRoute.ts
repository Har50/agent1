/**
 * Intent execute route — Tenderly preHandler then Safe/Pimlico UserOp.
 * Also exposes WebMCP x402 session-key intent endpoint: POST /v1/intent
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  verifyMessage,
  encodeFunctionData,
  parseUnits,
  type Hex,
  type Address,
} from 'viem';
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
import { getSmartAccountAddress } from '../services/safeAccount.js';

type WebMcpIntentBody = {
  toolName: string;
  targetContract: string;
  abiMethod: string;
  args?: Record<string, unknown>;
};

const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const PER_INTENT_SPEND_CAP_USD = Number(
  process.env.WEBMCP_PER_INTENT_CAP_USD || 10
);

async function handleWebMcpIntent(
  request: {
    headers: Record<string, unknown>;
    body: unknown;
    log: { info: (...args: unknown[]) => void };
  },
  reply: {
    status: (code: number) => {
      send: (body: unknown) => unknown;
    };
  }
) {
  const signature = request.headers['x-402-payment-signature'];
  const payloadHeader = request.headers['x-402-payment-payload'];
  const sessionKeyAddress = request.headers['x-session-key-address'];

  if (
    typeof signature !== 'string' ||
    typeof payloadHeader !== 'string' ||
    typeof sessionKeyAddress !== 'string'
  ) {
    return reply.status(402).send({
      error: 'Payment Required',
      message: 'Missing x402 headers or Session Key context',
    });
  }

  let payload: {
    tool?: string;
    amountUSD?: number;
    recipient?: string;
  };
  try {
    payload = JSON.parse(payloadHeader) as typeof payload;
  } catch {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'X-402-Payment-Payload must be JSON',
    });
  }

  let validSig = false;
  try {
    validSig = await verifyMessage({
      address: sessionKeyAddress as Address,
      message: payloadHeader,
      signature: signature as Hex,
    });
  } catch {
    validSig = false;
  }

  if (!validSig) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Session Key signature verification failed',
    });
  }

  const amountUSD = Number(payload.amountUSD ?? 0);
  if (!Number.isFinite(amountUSD) || amountUSD <= 0) {
    return reply.status(402).send({
      error: 'Payment Required',
      message: 'Invalid amountUSD in payment payload',
    });
  }

  if (amountUSD > PER_INTENT_SPEND_CAP_USD) {
    return reply.status(402).send({
      error: 'Policy Violation',
      message: `Transaction amount exceeds per-intent spend cap of $${PER_INTENT_SPEND_CAP_USD.toFixed(2)} USDC`,
    });
  }

  const body = request.body as WebMcpIntentBody;
  if (!body?.toolName || !body?.targetContract) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'toolName and targetContract are required',
    });
  }

  const recipient =
    (typeof body.args?.recipient === 'string' && body.args.recipient) ||
    payload.recipient ||
    '0x1111111111111111111111111111111111111111';

  const calldata = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [recipient as Address, parseUnits(String(amountUSD), 6)],
  });

  const fromAddress =
    ((await getSmartAccountAddress()) as Address | null) ||
    ('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address);

  const intent: Intent = {
    kind: 'custom',
    agentId: 'webmcp-session',
    chainId: config.chainId === 84532 ? 84532 : 8453,
    target: body.targetContract as `0x${string}`,
    data: calldata,
    valueWei: '0',
    slippageBps: 50,
    dryRun: config.EXECUTION_MODE !== 'live',
    metadata: {
      toolName: body.toolName,
      abiMethod: body.abiMethod,
      source: 'webmcp/v1/intent',
      sessionKeyAddress,
      amountUSD,
    },
  };

  const call: ResolvedCall = {
    to: body.targetContract as `0x${string}`,
    data: calldata,
    value: 0n,
    intent,
  };

  request.log.info({ tool: body.toolName, amountUSD }, 'WebMCP x402 intent');

  const intentId = newIntentId();
  const result = await executeUserOperation(call, intentId, {
    dryRun: intent.dryRun ?? false,
  });
  await recordTransaction(intent, intentId, result);

  if (result.status === 'rejected' || result.status === 'failed') {
    return reply.status(422).send({
      error: 'Execution Failed',
      message: result.error || result.status,
      intentId,
    });
  }

  return reply.status(200).send({
    status: 'SUCCESS',
    tool: body.toolName,
    settledAmountUSD: amountUSD,
    txHash: result.txHash,
    userOpHash: result.userOpHash,
    intentId,
    mode: result.mode ?? config.EXECUTION_MODE,
    network:
      config.chainId === 84532 ? 'Base Sepolia (84532)' : 'Base Mainnet (8453)',
    fromAddress,
  });
}

export const intentExecuteRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/intent', async (request, reply) =>
    handleWebMcpIntent(request as never, reply as never)
  );
  app.post('/api/v1/intent', async (request, reply) =>
    handleWebMcpIntent(request as never, reply as never)
  );

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
