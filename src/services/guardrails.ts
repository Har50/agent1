import type { Intent, SessionKey } from '../schemas/intent.js';
import { config } from '../config/env.js';

export type GuardrailVerdict =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Enforce session spending limits and allowlisted target contracts
 * before constructing / broadcasting a UserOperation.
 */
export function enforceGuardrails(
  intent: Intent,
  session: SessionKey | null
): GuardrailVerdict {
  if (session && !session.active) {
    return { ok: false, reason: 'Session is inactive' };
  }

  if (session?.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'Session expired' };
  }

  const target = intent.target?.toLowerCase();
  const allowed = new Set(
    (session?.allowedTargets ?? [...config.allowedTargets]).map((a) =>
      a.toLowerCase()
    )
  );

  if (target && allowed.size > 0 && !allowed.has(target)) {
    return {
      ok: false,
      reason: `Target ${intent.target} is not in the session allowlist`,
    };
  }

  const spendEstimate = estimateSpendUsdc(intent);
  const maxSpend = session?.maxSpendUsdc ?? config.DEFAULT_MAX_SPEND_USDC;
  const spent = session?.spentUsdc ?? 0;

  if (spent + spendEstimate > maxSpend) {
    return {
      ok: false,
      reason: `Spend limit exceeded: ${spent + spendEstimate} > ${maxSpend} USDC`,
    };
  }

  return { ok: true };
}

/** Rough USDC spend estimate from amount fields (decimals assumed 6 when USDC). */
export function estimateSpendUsdc(intent: Intent): number {
  if (intent.amountIn) {
    const n = Number(intent.amountIn);
    return Number.isFinite(n) ? n : 0;
  }
  if (intent.amountInWei) {
    // Assume 6 decimals (USDC) when only wei provided.
    return Number(intent.amountInWei) / 1e6;
  }
  return 0;
}
