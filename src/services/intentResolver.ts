import {
  encodeFunctionData,
  parseUnits,
  type Hex,
  type Address,
} from 'viem';
import type { Intent } from '../schemas/intent.js';
import { BASE_USDC, UNISWAP_V3_ROUTER } from '../config/baseRpc.js';
import { intentSchema } from '../schemas/intent.js';

const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

const swapRouterAbi = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

export type ResolvedCall = {
  to: Address;
  data: Hex;
  value: bigint;
  intent: Intent;
};

/**
 * Validate intent with zod and encode call data against known ABIs
 * (Uniswap v3 router / ERC-20) before simulation or UserOp build.
 */
export function resolveIntent(raw: unknown): ResolvedCall {
  const intent = intentSchema.parse(raw);

  switch (intent.kind) {
    case 'transfer': {
      const token = (intent.tokenIn ?? BASE_USDC) as Address;
      const to = intent.recipient;
      if (!to) throw new IntentResolutionError('transfer requires recipient');
      const amount = resolveAmountWei(intent);
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to as Address, amount],
      });
      return {
        to: token,
        data,
        value: 0n,
        intent: { ...intent, target: token },
      };
    }
    case 'approve': {
      const token = (intent.tokenIn ?? BASE_USDC) as Address;
      const spender = (intent.target ?? UNISWAP_V3_ROUTER) as Address;
      const amount = resolveAmountWei(intent);
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
      });
      return {
        to: token,
        data,
        value: 0n,
        intent: { ...intent, target: token },
      };
    }
    case 'swap': {
      const tokenIn = (intent.tokenIn ?? BASE_USDC) as Address;
      const tokenOut = intent.tokenOut as Address | undefined;
      if (!tokenOut) throw new IntentResolutionError('swap requires tokenOut');
      const recipient = (intent.recipient ??
        '0x0000000000000000000000000000000000000000') as Address;
      const amountIn = resolveAmountWei(intent);
      const router = (intent.target ?? UNISWAP_V3_ROUTER) as Address;
      const data = encodeFunctionData({
        abi: swapRouterAbi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn,
            tokenOut,
            fee: 3000,
            recipient,
            amountIn,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      return {
        to: router,
        data,
        value: BigInt(intent.valueWei),
        intent: { ...intent, target: router },
      };
    }
    case 'custom': {
      if (!intent.target || !intent.data) {
        throw new IntentResolutionError('custom intent requires target and data');
      }
      return {
        to: intent.target as Address,
        data: intent.data as Hex,
        value: BigInt(intent.valueWei),
        intent,
      };
    }
    default:
      throw new IntentResolutionError(`Unsupported intent kind: ${intent.kind}`);
  }
}

function resolveAmountWei(intent: Intent): bigint {
  if (intent.amountInWei) return BigInt(intent.amountInWei);
  if (intent.amountIn) {
    // Default 6 decimals (USDC on Base). Callers should pass amountInWei for other tokens.
    return parseUnits(intent.amountIn, 6);
  }
  throw new IntentResolutionError('amountIn or amountInWei is required');
}

export class IntentResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentResolutionError';
  }
}
