/**
 * WebMCP → AgentExec bridge.
 *
 * Registers browser-discoverable payable tools and routes execution through
 * AgentExec's Tenderly pre-flight + Pimlico-sponsored UserOp pipeline.
 */
import { encodeFunctionData, parseUnits } from 'viem';

export type WebMCPAgentExecConfig = {
  baseUrl: string;
  apiKey: string;
  sessionKey?: string;
  /** Max USDC per tool execution (client-side guard; default 50). */
  maxSessionSpendUsdc?: number;
  /** Smart account or EOA performing the UserOp. */
  fromAddress?: `0x${string}`;
  /** Optional session key id persisted in AgentExec. */
  sessionKeyId?: string;
  agentId?: string;
};

export type PayableWebMCPTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  targetContract: `0x${string}`;
  usdcPrice: string;
  /** Optional x402-protected AgentExec path (e.g. /v1/paid/market-pulse). */
  x402Path?: string;
};

export type WebMCPToolExecuteInput = {
  toolName: string;
  targetContract: `0x${string}`;
  usdcPrice: string;
  params: Record<string, unknown>;
  recipient?: `0x${string}`;
};

export type AgentExecExecutionResult = {
  status: 'SUCCESS' | '402_CHALLENGE_ISSUED' | 'ERROR';
  message?: string;
  txHash?: string;
  userOpHash?: string;
  paymentRequired?: unknown;
  intentId?: string;
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

export class WebMCPAgentExecAdapter {
  private readonly config: Required<
    Pick<WebMCPAgentExecConfig, 'baseUrl' | 'apiKey'>
  > &
    WebMCPAgentExecConfig;
  private readonly tools = new Map<string, PayableWebMCPTool>();

  constructor(config: WebMCPAgentExecConfig) {
    this.config = {
      maxSessionSpendUsdc: 50,
      agentId: 'webmcp-agent',
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey,
    };
  }

  /** Register a payable tool for WebMCP / navigator.modelContext discovery. */
  registerPayableWebMCPTool(tool: PayableWebMCPTool): void {
    this.tools.set(tool.name, tool);

    if (typeof globalThis !== 'undefined' && 'navigator' in globalThis) {
      const nav = globalThis.navigator as Navigator & {
        modelContext?: { registerTool?: (tool: unknown) => void };
      };
      nav.modelContext?.registerTool?.({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
        execute: async (params: Record<string, unknown>) =>
          this.executeViaAgentExec({
            toolName: tool.name,
            targetContract: tool.targetContract,
            usdcPrice: tool.usdcPrice,
            params,
          }),
      });
    }
  }

  /** Dispatch tool intent to AgentExec (x402 probe → simulate → UserOp). */
  async executeViaAgentExec(
    input: WebMCPToolExecuteInput
  ): Promise<AgentExecExecutionResult> {
    const price = Number.parseFloat(input.usdcPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return {
        status: 'ERROR',
        message: 'AgentExec Execution Failed: invalid usdcPrice',
      };
    }

    if (price > (this.config.maxSessionSpendUsdc ?? 50)) {
      return {
        status: 'ERROR',
        message: `AgentExec Execution Failed: spend cap breach ($${price.toFixed(
          2
        )} > $${this.config.maxSessionSpendUsdc} session limit)`,
      };
    }

    const registered = this.tools.get(input.toolName);
    if (registered?.x402Path) {
      const challenge = await this.probeX402(registered.x402Path);
      if (challenge) return challenge;
    }

    const recipient =
      input.recipient ??
      ('0x1111111111111111111111111111111111111111' as `0x${string}`);
    const amount = parseUnits(input.usdcPrice, 6);

    const calldata = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [recipient, amount],
    });

    const fromAddress =
      this.config.fromAddress ??
      ('0x0000000000000000000000000000000000000001' as `0x${string}`);

    try {
      const res = await fetch(`${this.config.baseUrl}/v1/intent/execute`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          fromAddress,
          targetAddress: input.targetContract,
          calldata,
          valueWei: '0',
          maxAllowedDrainUSD: price,
          agentId: this.config.agentId,
          sessionKeyId: this.config.sessionKeyId,
          networkId: '84532',
        }),
      });

      const body = (await res.json()) as Record<string, unknown>;

      if (res.status === 402) {
        return {
          status: '402_CHALLENGE_ISSUED',
          paymentRequired: body,
          message: 'HTTP 402 payment required before execution',
        };
      }

      if (!res.ok) {
        const reason =
          (body.reason as string) ||
          (body.message as string) ||
          (body.error as string) ||
          res.statusText;
        return {
          status: 'ERROR',
          message: `AgentExec Execution Failed: ${reason}`,
        };
      }

      return {
        status: 'SUCCESS',
        message: body.message as string | undefined,
        txHash: body.txHash as string | undefined,
        userOpHash: body.userOpHash as string | undefined,
        intentId: body.intentId as string | undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: 'ERROR',
        message: `AgentExec Execution Failed: ${msg}`,
      };
    }
  }

  private async probeX402(
    path: string
  ): Promise<AgentExecExecutionResult | null> {
    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        headers: { 'x-api-key': this.config.apiKey },
      });
      if (res.status !== 402) return null;
      const body = await res.json();
      return {
        status: '402_CHALLENGE_ISSUED',
        paymentRequired: body,
        message: 'HTTP 402 payment required before execution',
      };
    } catch {
      return null;
    }
  }
}
