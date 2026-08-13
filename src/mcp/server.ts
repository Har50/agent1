/**
 * MCP server — exposes Base Web3 execution tools to Claude, Cursor, AutoGPT.
 *
 * Talks to the Go gateway / Fastify API over HTTP (not in-process), so agents
 * hit the same Tenderly → session-key → UserOp path as REST clients.
 *
 *   npm run mcp
 *   # or after build:
 *   node dist/mcp/server.js
 *
 * Env:
 *   API_BASE_URL   — gateway or Fastify base (default http://localhost:8080)
 *   AGENT_API_KEY  — X-API-Key for the gateway
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.PUBLIC_BASE_URL ||
  'http://localhost:8080'
).replace(/\/$/, '');
const API_KEY =
  process.env.AGENT_API_KEY ||
  process.env.API_KEYS?.split(',')[0]?.trim() ||
  '';

const EXECUTE_INTENT_TOOL: Tool = {
  name: 'execute_onchain_intent',
  description:
    'Simulates and executes a gasless, sponsored Web3 transaction on Base L2 (e.g. token swaps, transfers). Runs Tenderly dry-run safety checks automatically before broadcasting.',
  inputSchema: {
    type: 'object',
    properties: {
      fromAddress: {
        type: 'string',
        description: 'The Safe Smart Account address performing the action.',
      },
      targetAddress: {
        type: 'string',
        description: 'Target contract or token recipient address.',
      },
      calldata: {
        type: 'string',
        description: 'Hex-encoded transaction calldata.',
      },
      valueWei: {
        type: 'string',
        description: "Native token value in Wei (defaults to '0').",
      },
      maxAllowedDrainUSD: {
        type: 'number',
        description:
          'Maximum allowable wallet drain in USD during simulation guardrail check.',
      },
      sessionKeyId: {
        type: 'string',
        description: 'Optional ERC-7579 session key id to enforce spend/target caps.',
      },
      agentId: {
        type: 'string',
        description: 'Agent identifier for session scoping.',
      },
    },
    required: ['fromAddress', 'targetAddress', 'calldata'],
  },
};

const GET_ACCOUNT_TOOL: Tool = {
  name: 'get_smart_account_info',
  description:
    'Retrieves the Agent Owner EOA address and counterfactual Safe Smart Wallet address on Base.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const SIMULATE_TX_TOOL: Tool = {
  name: 'dry_run_simulation',
  description:
    'Simulates a transaction on Tenderly without broadcasting. Returns predicted gas and balance changes.',
  inputSchema: {
    type: 'object',
    properties: {
      fromAddress: { type: 'string' },
      targetAddress: { type: 'string' },
      calldata: { type: 'string' },
      valueWei: { type: 'string' },
      maxAllowedDrainUSD: { type: 'number' },
    },
    required: ['fromAddress', 'targetAddress', 'calldata'],
  },
};

const ISSUE_SESSION_KEY_TOOL: Tool = {
  name: 'issue_session_key',
  description:
    'Issue an ERC-7579 / ZeroDev-scoped session key (time limit, USDC spend cap, target whitelist).',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      maxUsdc: { type: 'number' },
      ttlHours: { type: 'number' },
      target: { type: 'string' },
    },
    required: ['agentId'],
  },
};

async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  if (init?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = { message: await response.text() };
  }
  return { ok: response.ok, status: response.status, data };
}

const server = new Server(
  {
    name: 'base-web3-transaction-provider',
    version: '1.0.0',
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    EXECUTE_INTENT_TOOL,
    GET_ACCOUNT_TOOL,
    SIMULATE_TX_TOOL,
    ISSUE_SESSION_KEY_TOOL,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const body = (args ?? {}) as Record<string, unknown>;

  try {
    if (name === 'execute_onchain_intent') {
      const { ok, status, data } = await apiFetch('/v1/intent/execute', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!ok) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Transaction Blocked/Failed [${String(data.code || status)}]: ${String(data.reason || data.message || data.error || 'unknown')}`,
            },
          ],
        };
      }
      const sim = data.simulationSummary as
        | { gasEstimated?: number | string }
        | undefined;
      return {
        content: [
          {
            type: 'text' as const,
            text: `Transaction Executed Successfully!\nUserOp Hash: ${String(data.userOpHash || data.txHash || 'Confirmed')}\nIntent ID: ${String(data.intentId || 'N/A')}\nEstimated Gas: ${String(sim?.gasEstimated ?? 'N/A')}`,
          },
        ],
      };
    }

    if (name === 'get_smart_account_info') {
      const { ok, data } = await apiFetch('/v1/account');
      if (!ok) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Failed to fetch account: ${JSON.stringify(data)}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (name === 'dry_run_simulation') {
      const { ok, data } = await apiFetch('/v1/intent/simulate-only', {
        method: 'POST',
        body: JSON.stringify({ ...body, dryRun: true }),
      });
      const sim = (data.simulation ?? data) as Record<string, unknown>;
      return {
        isError: !ok,
        content: [
          {
            type: 'text' as const,
            text: `Simulation Results:\nSuccess: ${String(sim.success ?? ok)}\nGas Estimated: ${String(sim.gasUsed ?? 'N/A')}\nBalance Deltas: ${JSON.stringify(sim.balanceChanges || [])}`,
          },
        ],
      };
    }

    if (name === 'issue_session_key') {
      const { ok, data } = await apiFetch('/v1/session-keys/issue', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!ok) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Session key issue failed: ${JSON.stringify(data)}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool requested: ${name}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: `MCP Tool Execution Error: ${message}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Base Web3 Execution MCP Server running on stdio → ${API_BASE_URL}`
  );
}

main().catch((error) => {
  console.error('Fatal error running MCP server:', error);
  process.exit(1);
});
