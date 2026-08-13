import type { Intent, ExecuteResult } from '../schemas/intent.js';
import {
  defaultSession,
  getSession,
  newIntentId,
  recordTransaction,
  upsertSession,
} from '../db/repository.js';
import { enforceGuardrails } from './guardrails.js';
import {
  IntentResolutionError,
  resolveIntent,
} from './intentResolver.js';
import { executeUserOperation } from './userOp.js';
import {
  enforceSessionKeyScope,
  recordSessionKeySpend,
} from './sessionKeys.js';
import { config } from '../config/env.js';
import { resolveBaseChain } from './safeAccount.js';

/**
 * Full intent pipeline:
 * validate → resolve ABI → session/session-key guardrails →
 * Tenderly/viem safety → (optional) UserOp broadcast.
 */
export async function processIntent(raw: unknown): Promise<ExecuteResult> {
  let intent: Intent;
  let resolved;
  try {
    resolved = resolveIntent(raw);
    intent = {
      ...resolved.intent,
      chainId: resolved.intent.chainId ?? (resolveBaseChain().id as 8453 | 84532),
    };
    resolved = { ...resolved, intent };
  } catch (err) {
    const message =
      err instanceof IntentResolutionError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Invalid intent';
    return {
      status: 'rejected',
      intentId: newIntentId(),
      error: message,
      mode: config.EXECUTION_MODE,
    };
  }

  const intentId = newIntentId();
  const sessionId = intent.sessionId ?? `session_${intent.agentId}`;
  let session = await getSession(sessionId);
  if (!session) {
    session = await upsertSession(defaultSession(intent.agentId, sessionId));
  }

  const guard = enforceGuardrails(intent, session);
  if (!guard.ok) {
    const result: ExecuteResult = {
      status: 'rejected',
      intentId,
      error: guard.reason,
      mode: config.EXECUTION_MODE,
    };
    await recordTransaction(intent, intentId, result);
    return result;
  }

  const sk = await enforceSessionKeyScope(
    intent,
    resolved,
    intent.sessionKeyId
  );
  if (!sk.ok) {
    const result: ExecuteResult = {
      status: 'rejected',
      intentId,
      error: sk.reason,
      mode: config.EXECUTION_MODE,
    };
    await recordTransaction(intent, intentId, result, intent.sessionKeyId);
    return result;
  }

  const result = await executeUserOperation(resolved, intentId, {
    dryRun: intent.dryRun,
  });
  await recordTransaction(intent, intentId, result, sk.scope?.id);

  if (
    sk.scope &&
    (result.status === 'submitted' ||
      result.status === 'confirmed' ||
      result.status === 'simulated')
  ) {
    await recordSessionKeySpend(sk.scope, intent);
  }

  return result;
}
