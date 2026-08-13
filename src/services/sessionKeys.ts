import type { Intent } from '../schemas/intent.js';
import type { SessionKeyScope } from '../schemas/sessionKey.js';
import {
  getSessionKeyByAgent,
  getSessionKeyScope,
  upsertSessionKeyScope,
} from '../db/repository.js';
import { estimateSpendUsdc } from './guardrails.js';
import { config } from '../config/env.js';
import type { ResolvedCall } from './intentResolver.js';

export type SessionKeyVerdict =
  | { ok: true; scope: SessionKeyScope | null }
  | { ok: false; reason: string };

/**
 * Enforce ERC-7579-style session key scopes (value cap, target whitelist,
 * optional selector allowlist, expiry, rolling spend window).
 */
export async function enforceSessionKeyScope(
  intent: Intent,
  call: ResolvedCall,
  sessionKeyId?: string
): Promise<SessionKeyVerdict> {
  if (config.SESSION_KEY_MODE === 'off') {
    return { ok: true, scope: null };
  }

  let scope: SessionKeyScope | null = null;
  if (sessionKeyId) {
    scope = await getSessionKeyScope(sessionKeyId);
  } else {
    scope = await getSessionKeyByAgent(intent.agentId);
  }

  // No issued key yet — allow (legacy session guardrails still apply).
  if (!scope) return { ok: true, scope: null };

  if (!scope.active) {
    return { ok: false, reason: `Session key ${scope.id} is inactive` };
  }

  if (scope.expiresAt && new Date(scope.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: `Session key ${scope.id} expired` };
  }

  // Reset rolling window if elapsed.
  const windowStart = scope.windowStartedAt
    ? new Date(scope.windowStartedAt).getTime()
    : Date.now();
  const windowMs = scope.spendWindowSeconds * 1000;
  let spent = scope.spentUsdc;
  if (Date.now() - windowStart > windowMs) {
    spent = 0;
    scope = {
      ...scope,
      spentUsdc: 0,
      windowStartedAt: new Date().toISOString(),
    };
    await upsertSessionKeyScope(scope);
  }

  const target = call.to.toLowerCase();
  if (scope.allowedTargets.length > 0) {
    const allowed = new Set(scope.allowedTargets.map((a) => a.toLowerCase()));
    if (!allowed.has(target)) {
      return {
        ok: false,
        reason: `Session key blocks target ${call.to} (not in whitelist)`,
      };
    }
  }

  if (scope.allowedSelectors.length > 0 && call.data.length >= 10) {
    const selector = call.data.slice(0, 10).toLowerCase();
    const allowed = new Set(
      scope.allowedSelectors.map((s) => s.toLowerCase())
    );
    if (!allowed.has(selector)) {
      return {
        ok: false,
        reason: `Session key blocks selector ${selector}`,
      };
    }
  }

  const spend = estimateSpendUsdc(intent);
  if (spent + spend > scope.maxSpendUsdc) {
    return {
      ok: false,
      reason: `Session key spend cap exceeded: ${spent + spend} > ${scope.maxSpendUsdc} USDC / ${scope.spendWindowSeconds}s`,
    };
  }

  return { ok: true, scope };
}

/** Increment spent amount after a successful / submitted intent. */
export async function recordSessionKeySpend(
  scope: SessionKeyScope,
  intent: Intent
): Promise<void> {
  const spend = estimateSpendUsdc(intent);
  if (spend <= 0) return;
  await upsertSessionKeyScope({
    ...scope,
    spentUsdc: scope.spentUsdc + spend,
  });
}

/**
 * ZeroDev Kernel integration hook.
 * When ZERODEV_PROJECT_ID is set, attempt to attach on-chain session validation.
 * Offline / CI uses DB-enforced scopes only.
 */
export async function provisionZeroDevSessionHint<T extends SessionKeyScope>(
  scope: T
): Promise<T> {
  if (config.SESSION_KEY_MODE !== 'zerodev' || !config.ZERODEV_PROJECT_ID) {
    return {
      ...scope,
      metadata: {
        ...scope.metadata,
        provisioner: 'db',
        note: 'On-chain Kernel module not provisioned — DB enforcement active',
      },
    };
  }

  try {
    await import('@zerodev/sdk');
    return {
      ...scope,
      metadata: {
        ...scope.metadata,
        provisioner: 'zerodev',
        projectId: config.ZERODEV_PROJECT_ID,
        note: 'ZeroDev SDK available — install session validator on Kernel account before live use',
      },
    };
  } catch {
    return {
      ...scope,
      metadata: {
        ...scope.metadata,
        provisioner: 'db-fallback',
        note: '@zerodev/sdk not installed or failed to load',
      },
    };
  }
}
