/**
 * Client WebMCP adapter — signs x402 payment payloads with a session key
 * and posts tool intents to the AgentExec Fastify gateway.
 *
 * Uses viem (repo standard) instead of ethers.
 */
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

export interface WebMCPToolPayload {
  name: string;
  description: string;
  priceUSD: number;
  targetContract: string;
  abiMethod: string;
}

export interface PaymentPayload {
  tool: string;
  amountUSD: number;
  recipient: string;
  timestamp: number;
  nonce: string;
}

export type ExecuteToolResult = {
  status: string;
  tool?: string;
  settledAmountUSD?: number;
  txHash?: string;
  userOpHash?: string;
  network?: string;
  [key: string]: unknown;
};

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export class AgentExecSDK {
  private gatewayUrl: string;

  constructor(gatewayUrl = 'http://localhost:8787') {
    this.gatewayUrl = gatewayUrl.replace(/\/$/, '');
  }

  /**
   * Executes a WebMCP tool call by attaching signed x402 payment headers
   * and authorizing via a session-key signature.
   */
  async executeToolCall(
    tool: WebMCPToolPayload,
    args: Record<string, unknown>,
    sessionPrivateKey: string
  ): Promise<ExecuteToolResult> {
    const key = (
      sessionPrivateKey.startsWith('0x')
        ? sessionPrivateKey
        : `0x${sessionPrivateKey}`
    ) as Hex;
    const account = privateKeyToAccount(key);

    const paymentPayload: PaymentPayload = {
      tool: tool.name,
      amountUSD: tool.priceUSD,
      recipient: tool.targetContract,
      timestamp: Date.now(),
      nonce: randomNonce(),
    };

    const payloadString = JSON.stringify(paymentPayload);
    const signature = await account.signMessage({ message: payloadString });

    const response = await fetch(`${this.gatewayUrl}/v1/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':
          process.env.AGENT_API_KEY ||
          process.env.NEXT_PUBLIC_AGENT_API_KEY ||
          'dev-agent-key',
        'X-402-Payment-Signature': signature,
        'X-402-Payment-Payload': payloadString,
        'X-Session-Key-Address': account.address,
      },
      body: JSON.stringify({
        toolName: tool.name,
        targetContract: tool.targetContract,
        abiMethod: tool.abiMethod,
        args,
      }),
    });

    if (response.status === 402) {
      const err = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        `402 Payment Authorization Failed: ${err.message || response.statusText}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Execution error (${response.status}): ${await response.text()}`
      );
    }

    return (await response.json()) as ExecuteToolResult;
  }
}

export const agentExecSDK = new AgentExecSDK(
  process.env.AGENTEXEC_BASE_URL ||
    process.env.NEXT_PUBLIC_AGENTEXEC_URL ||
    'http://localhost:8787'
);
