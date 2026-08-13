import { z } from 'zod';

/** Hex address (checksum optional). */
export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address');

export const intentKindSchema = z.enum([
  'swap',
  'transfer',
  'approve',
  'custom',
]);

/**
 * Natural-language / agent intent payload.
 * Validated before ABI encoding or UserOp construction.
 */
export const intentSchema = z.object({
  kind: intentKindSchema,
  agentId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128).optional(),
  chainId: z.union([z.literal(8453), z.literal(84532)]).default(8453),
  /** Optional ERC-7579 / ZeroDev session key id */
  sessionKeyId: z.string().min(1).max(128).optional(),
  /** Human-readable prompt (optional; used when LLM resolves params). */
  prompt: z.string().max(2000).optional(),
  /** Token / amount fields for swap & transfer. */
  tokenIn: addressSchema.optional(),
  tokenOut: addressSchema.optional(),
  amountIn: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'amountIn must be a decimal string')
    .optional(),
  amountInWei: z
    .string()
    .regex(/^\d+$/, 'amountInWei must be an integer string')
    .optional(),
  recipient: addressSchema.optional(),
  /** Target contract for custom / approve / swap router. */
  target: addressSchema.optional(),
  /** ABI-encoded calldata for custom intents. */
  data: z
    .string()
    .regex(/^0x[0-9a-fA-F]*$/, 'data must be hex')
    .optional(),
  valueWei: z
    .string()
    .regex(/^\d+$/)
    .default('0'),
  slippageBps: z.number().int().min(0).max(5000).default(50),
  /** Skip broadcast; only simulate. */
  dryRun: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type Intent = z.infer<typeof intentSchema>;

export const sessionKeySchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  maxSpendUsdc: z.number().positive(),
  spentUsdc: z.number().nonnegative().default(0),
  allowedTargets: z.array(addressSchema).default([]),
  expiresAt: z.string().datetime().optional(),
  active: z.boolean().default(true),
});

export type SessionKey = z.infer<typeof sessionKeySchema>;

export const executeResultSchema = z.object({
  status: z.enum(['simulated', 'submitted', 'confirmed', 'failed', 'rejected']),
  intentId: z.string(),
  userOpHash: z.string().optional(),
  txHash: z.string().optional(),
  simulation: z
    .object({
      success: z.boolean(),
      gasUsed: z.string().optional(),
      revertReason: z.string().optional(),
      balanceChanges: z
        .array(
          z.object({
            token: z.string(),
            delta: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
  error: z.string().optional(),
  mode: z.enum(['live', 'simulate', 'mock']),
  safetyProvider: z.enum(['tenderly', 'viem', 'mock']).optional(),
});

export type ExecuteResult = z.infer<typeof executeResultSchema>;
