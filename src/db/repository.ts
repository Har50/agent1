import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from './client.js';
import { agents, sessionKeys, sessions, transactions } from './schema.js';
import type { ExecuteResult, Intent, SessionKey } from '../schemas/intent.js';
import type { SessionKeyScope } from '../schemas/sessionKey.js';
import { config } from '../config/env.js';

/** In-memory fallback when Postgres is unavailable. */
const memAgents = new Map<string, { id: string; name: string }>();
const memSessions = new Map<string, SessionKey>();
const memSessionKeys = new Map<string, SessionKeyScope>();
const memTx = new Map<
  string,
  {
    intentId: string;
    agentId: string;
    sessionId?: string;
    sessionKeyId?: string;
    kind: string;
    status: string;
    target?: string;
    result?: ExecuteResult;
    createdAt: string;
  }
>();

export async function ensureAgent(agentId: string, name?: string): Promise<void> {
  const db = getDb();
  if (!db) {
    if (!memAgents.has(agentId)) {
      memAgents.set(agentId, { id: agentId, name: name ?? agentId });
    }
    return;
  }
  await db
    .insert(agents)
    .values({ id: agentId, name: name ?? agentId })
    .onConflictDoNothing();
}

export async function upsertSession(session: SessionKey): Promise<SessionKey> {
  await ensureAgent(session.agentId);
  const db = getDb();
  if (!db) {
    memSessions.set(session.sessionId, session);
    return session;
  }
  await db
    .insert(sessions)
    .values({
      id: session.sessionId,
      agentId: session.agentId,
      maxSpendUsdc: String(session.maxSpendUsdc),
      spentUsdc: String(session.spentUsdc),
      allowedTargets: session.allowedTargets,
      expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
      active: session.active,
    })
    .onConflictDoUpdate({
      target: sessions.id,
      set: {
        maxSpendUsdc: String(session.maxSpendUsdc),
        spentUsdc: String(session.spentUsdc),
        allowedTargets: session.allowedTargets,
        expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
        active: session.active,
      },
    });
  return session;
}

export async function getSession(
  sessionId: string
): Promise<SessionKey | null> {
  const db = getDb();
  if (!db) return memSessions.get(sessionId) ?? null;
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    agentId: row.agentId,
    sessionId: row.id,
    maxSpendUsdc: Number(row.maxSpendUsdc),
    spentUsdc: Number(row.spentUsdc),
    allowedTargets: row.allowedTargets ?? [],
    expiresAt: row.expiresAt?.toISOString(),
    active: row.active,
  };
}

export function defaultSession(agentId: string, sessionId: string): SessionKey {
  return {
    agentId,
    sessionId,
    maxSpendUsdc: config.DEFAULT_MAX_SPEND_USDC,
    spentUsdc: 0,
    allowedTargets: [...config.allowedTargets],
    active: true,
  };
}

function rowToSessionKeyScope(row: typeof sessionKeys.$inferSelect): SessionKeyScope {
  return {
    id: row.id,
    agentId: row.agentId,
    sessionId: row.sessionId ?? undefined,
    publicKey: row.publicKey,
    kernelAddress: row.kernelAddress ?? undefined,
    maxSpendUsdc: Number(row.maxSpendUsdc),
    spentUsdc: Number(row.spentUsdc),
    spendWindowSeconds: row.spendWindowSeconds,
    windowStartedAt: row.windowStartedAt.toISOString(),
    allowedTargets: row.allowedTargets ?? [],
    allowedSelectors: row.allowedSelectors ?? [],
    expiresAt: row.expiresAt?.toISOString(),
    active: row.active,
    metadata: row.metadata ?? undefined,
  };
}

export async function upsertSessionKeyScope(
  scope: SessionKeyScope
): Promise<SessionKeyScope> {
  await ensureAgent(scope.agentId);
  const normalized: SessionKeyScope = {
    ...scope,
    spentUsdc: scope.spentUsdc ?? 0,
    windowStartedAt: scope.windowStartedAt ?? new Date().toISOString(),
  };
  const db = getDb();
  if (!db) {
    memSessionKeys.set(normalized.id, normalized);
    return normalized;
  }
  await db
    .insert(sessionKeys)
    .values({
      id: normalized.id,
      agentId: normalized.agentId,
      sessionId: normalized.sessionId,
      publicKey: normalized.publicKey,
      kernelAddress: normalized.kernelAddress,
      maxSpendUsdc: String(normalized.maxSpendUsdc),
      spentUsdc: String(normalized.spentUsdc),
      spendWindowSeconds: normalized.spendWindowSeconds,
      windowStartedAt: new Date(normalized.windowStartedAt!),
      allowedTargets: normalized.allowedTargets,
      allowedSelectors: normalized.allowedSelectors,
      expiresAt: normalized.expiresAt ? new Date(normalized.expiresAt) : null,
      active: normalized.active,
      metadata: normalized.metadata,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: sessionKeys.id,
      set: {
        publicKey: normalized.publicKey,
        kernelAddress: normalized.kernelAddress,
        maxSpendUsdc: String(normalized.maxSpendUsdc),
        spentUsdc: String(normalized.spentUsdc),
        spendWindowSeconds: normalized.spendWindowSeconds,
        windowStartedAt: new Date(normalized.windowStartedAt!),
        allowedTargets: normalized.allowedTargets,
        allowedSelectors: normalized.allowedSelectors,
        expiresAt: normalized.expiresAt ? new Date(normalized.expiresAt) : null,
        active: normalized.active,
        metadata: normalized.metadata,
        updatedAt: new Date(),
      },
    });
  return normalized;
}

export async function getSessionKeyScope(
  id: string
): Promise<SessionKeyScope | null> {
  const db = getDb();
  if (!db) return memSessionKeys.get(id) ?? null;
  const rows = await db
    .select()
    .from(sessionKeys)
    .where(eq(sessionKeys.id, id))
    .limit(1);
  return rows[0] ? rowToSessionKeyScope(rows[0]) : null;
}

export async function getSessionKeyByAgent(
  agentId: string
): Promise<SessionKeyScope | null> {
  const db = getDb();
  if (!db) {
    for (const scope of memSessionKeys.values()) {
      if (scope.agentId === agentId && scope.active) return scope;
    }
    return null;
  }
  const rows = await db
    .select()
    .from(sessionKeys)
    .where(eq(sessionKeys.agentId, agentId))
    .limit(20);
  const active = rows
    .map(rowToSessionKeyScope)
    .find((s) => s.active);
  return active ?? null;
}

export async function recordTransaction(
  intent: Intent,
  intentId: string,
  result: ExecuteResult,
  sessionKeyId?: string
): Promise<void> {
  const db = getDb();
  if (!db) {
    memTx.set(intentId, {
      intentId,
      agentId: intent.agentId,
      sessionId: intent.sessionId,
      sessionKeyId,
      kind: intent.kind,
      status: result.status,
      target: intent.target,
      result,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  await db.insert(transactions).values({
    intentId,
    agentId: intent.agentId,
    sessionId: intent.sessionId,
    sessionKeyId,
    kind: intent.kind,
    status: result.status,
    target: intent.target,
    valueWei: intent.valueWei,
    userOpHash: result.userOpHash,
    txHash: result.txHash,
    payload: intent as unknown as Record<string, unknown>,
    result: result as unknown as Record<string, unknown>,
    chainId: intent.chainId,
  });
}

export async function getTransaction(intentId: string) {
  const db = getDb();
  if (!db) return memTx.get(intentId) ?? null;
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.intentId, intentId))
    .limit(1);
  return rows[0] ?? null;
}

export function newIntentId(): string {
  return `intent_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}
