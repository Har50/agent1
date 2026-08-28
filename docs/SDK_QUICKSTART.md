# AgentExec WebMCP Client SDK

Connect browser-native WebMCP actions directly to AgentExec's execution safety net and Base L2 micropayment engine.

## Installation

From this monorepo (during development):

```bash
npm install
npm run build
```

When published:

```bash
npm install @agentexec/sdk
```

## Quickstart

### 1. Initialize the Adapter

```typescript
import { WebMCPAgentExecAdapter } from '../src/sdk/webmcp-agentexec-adapter.js';
// Published: import { WebMCPAgentExecAdapter } from '@agentexec/sdk';

const agentExec = new WebMCPAgentExecAdapter({
  baseUrl: 'https://api.agentexec.io', // Or local gateway http://localhost:8080
  apiKey: process.env.NEXT_PUBLIC_AGENT_API_KEY!,
  sessionKey: userSessionKey,
  fromAddress: '0xYourSafeSmartAccount',
  maxSessionSpendUsdc: 50,
});
```

### 2. Register a Payable WebMCP Tool

Make any action on your website discoverable by visiting AI agents while delegating security, simulation, and gas sponsorship to AgentExec:

```typescript
agentExec.registerPayableWebMCPTool({
  name: 'purchase_market_report',
  description: 'Unlocks real-time liquidity analysis for Base L2 pools',
  parameters: {
    type: 'object',
    properties: {
      pair: { type: 'string' },
    },
    required: ['pair'],
  },
  targetContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
  usdcPrice: '0.10',
  x402Path: '/v1/paid/market-pulse', // optional HTTP 402 gate
});
```

### 3. How It Works Under the Hood

1. **Discovery** — The AI agent reads the registered tool from `navigator.modelContext` (when available).
2. **Intent & pre-flight** — The action triggers an intent dispatch to `POST /v1/intent/execute`.
3. **Tenderly simulation** — AgentExec dry-runs the call to block reverts and balance drains.
4. **Gasless settlement** — AgentExec submits an ERC-4337 UserOp sponsored by Pimlico paymasters on Base L2.

## Integration tests

```bash
npm test -- tests/integration/webmcp-agentexec.test.ts
```

## Environment

| Variable | Purpose |
|----------|---------|
| `AGENTEXEC_BASE_URL` | API or gateway base URL |
| `AGENT_API_KEY` | `X-API-Key` header |
| `TEST_SESSION_KEY` | Optional session key for tests |
