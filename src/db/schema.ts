import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 128 }).primaryKey(),
  agentId: varchar('agent_id', { length: 128 })
    .notNull()
    .references(() => agents.id),
  maxSpendUsdc: numeric('max_spend_usdc', { precision: 18, scale: 6 }).notNull(),
  spentUsdc: numeric('spent_usdc', { precision: 18, scale: 6 }).notNull().default('0'),
  allowedTargets: jsonb('allowed_targets').$type<string[]>().notNull().default([]),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * ERC-7579 / ZeroDev-style session key scopes persisted for agents.
 * Enforced in-process even when Kernel modules are not yet on-chain.
 */
export const sessionKeys = pgTable('session_keys', {
  id: varchar('id', { length: 128 }).primaryKey(),
  agentId: varchar('agent_id', { length: 128 })
    .notNull()
    .references(() => agents.id),
  sessionId: varchar('session_id', { length: 128 }),
  /** Public key / address of the session signer */
  publicKey: varchar('public_key', { length: 128 }).notNull(),
  /** Kernel account address when ZeroDev is used */
  kernelAddress: varchar('kernel_address', { length: 42 }),
  maxSpendUsdc: numeric('max_spend_usdc', { precision: 18, scale: 6 }).notNull(),
  spentUsdc: numeric('spent_usdc', { precision: 18, scale: 6 }).notNull().default('0'),
  /** Rolling window spend reset (seconds). Default 24h. */
  spendWindowSeconds: integer('spend_window_seconds').notNull().default(86_400),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  allowedTargets: jsonb('allowed_targets').$type<string[]>().notNull().default([]),
  /** Optional 4-byte selectors allowlist, e.g. ["0xa9059cbb"] */
  allowedSelectors: jsonb('allowed_selectors').$type<string[]>().notNull().default([]),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: varchar('intent_id', { length: 64 }).notNull().unique(),
  agentId: varchar('agent_id', { length: 128 }).notNull(),
  sessionId: varchar('session_id', { length: 128 }),
  sessionKeyId: varchar('session_key_id', { length: 128 }),
  kind: varchar('kind', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  target: varchar('target', { length: 42 }),
  valueWei: text('value_wei').default('0'),
  userOpHash: varchar('user_op_hash', { length: 66 }),
  txHash: varchar('tx_hash', { length: 66 }),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  result: jsonb('result').$type<Record<string, unknown>>(),
  chainId: integer('chain_id').notNull().default(8453),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AgentRow = typeof agents.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SessionKeyRow = typeof sessionKeys.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
