import { z } from 'zod';
import { addressSchema } from './intent.js';

export const sessionKeyScopeSchema = z.object({
  id: z.string().min(1).max(128),
  agentId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128).optional(),
  publicKey: z.string().min(1).max(128),
  kernelAddress: addressSchema.optional(),
  maxSpendUsdc: z.number().positive().default(50),
  spentUsdc: z.number().nonnegative().default(0),
  spendWindowSeconds: z.number().int().positive().default(86_400),
  windowStartedAt: z.string().datetime().optional(),
  allowedTargets: z.array(addressSchema).default([]),
  allowedSelectors: z
    .array(z.string().regex(/^0x[0-9a-fA-F]{8}$/))
    .default([]),
  expiresAt: z.string().datetime().optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export type SessionKeyScope = z.infer<typeof sessionKeyScopeSchema>;

export const issueSessionKeySchema = sessionKeyScopeSchema.omit({
  spentUsdc: true,
  windowStartedAt: true,
});

export type IssueSessionKeyInput = z.infer<typeof issueSessionKeySchema>;
