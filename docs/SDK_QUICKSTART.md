# @agentexec/sdk + WebMCP Integration Guide

This guide details how to integrate browser-native AI agent tool discovery (**WebMCP**) with backend L2 gasless execution and **x402** micropayments (**AgentExec**).

## Installation

```bash
npm install @agentexec/sdk
# or
pnpm add @agentexec/sdk
```

**This monorepo (pre-publish):**

```bash
npm install
npm run build
```

| Published import | Monorepo path |
|------------------|---------------|
| `@agentexec/sdk` | `src/sdk/webmcp-adapter.ts` (+ `src/sdk/index.ts`) |
| `@agentexec/sdk/react` | `website/src/components/WebMCPProvider.tsx` |

## Step 1: Wrap Your Application with `<WebMCPProvider>`

In your root layout (`app/layout.tsx` or `pages/_app.tsx`), wrap your application to initialize `window.navigator.modelContext`.

```tsx
import { WebMCPProvider } from "@agentexec/sdk/react";
// Monorepo: import { WebMCPProvider } from "@/components/WebMCPProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WebMCPProvider>{children}</WebMCPProvider>
      </body>
    </html>
  );
}
```

## Step 2: Register a WebMCP Tool on a Page

Expose structured actions to visiting AI agents (e.g. Anthropic Computer Use, Stagehand, browser tools) without relying on DOM scraping.

```tsx
"use client";

import { useEffect } from "react";
import { useWebMCP } from "@agentexec/sdk/react";
// Monorepo: import { useWebMCP } from "@/components/WebMCPProvider";

export function PremiumDataWidget() {
  const { registerTool } = useWebMCP();

  useEffect(() => {
    registerTool({
      name: "fetch_market_analytics",
      description:
        "Access real-time on-chain analytics for Base L2 ecosystem",
      priceUSD: 0.1, // Cost in USDC per call
      parameters: {
        type: "object",
        properties: {
          timeframe: { type: "string", enum: ["1h", "24h", "7d"] },
        },
        required: ["timeframe"],
      },
      handler: async (args) => {
        console.log("Agent requested timeframe:", args.timeframe);
        // Optional: call agentExecSDK.executeToolCall(...) here
      },
    });
  }, [registerTool]);

  return <div>Premium Market Analytics ($0.10 USDC / query)</div>;
}
```

> **Note:** Settlement fields (`targetContract`, `abiMethod`, `priceUSD`) are passed to `agentExecSDK.executeToolCall` when executing. Browser registration focuses on name, description, JSON Schema `parameters`, and the local `handler`.

## Step 3: Intercept & Execute Payment via Session Keys

Use `agentExecSDK` to execute tool calls. The SDK handles HTTP **402 Payment Required** challenges, signs payloads via user-delegated session keys, runs **Tenderly** pre-flight simulations, and broadcasts UserOps via **Pimlico** on Base L2.

```ts
import { agentExecSDK } from "@agentexec/sdk";
// Monorepo: import { agentExecSDK } from "../src/sdk/webmcp-adapter.js";

async function executeAgentAction() {
  const sessionPrivateKey = "0x..."; // Active session key with spend-cap policy

  try {
    const result = await agentExecSDK.executeToolCall(
      {
        name: "fetch_market_analytics",
        description: "Access real-time on-chain analytics",
        priceUSD: 0.1,
        targetContract: "0x5D5a97110a7504dc04e2442B669B0FB408aE74B6",
        abiMethod: "getAnalytics()",
      },
      { timeframe: "24h" },
      sessionPrivateKey
    );

    console.log("Transaction Hash:", result.txHash);
    console.log("Settled Amount:", result.settledAmountUSD);
  } catch (error) {
    console.error(
      "Execution failed:",
      error instanceof Error ? error.message : error
    );
  }
}
```

### What happens under the hood

1. SDK builds an x402 payment payload and signs it with the session key (viem / EIP-191).
2. `POST /v1/intent` (alias `/api/v1/intent`) verifies the signature and enforces the **$10.00** per-intent spend cap.
3. `simulateTransaction` dry-runs on Tenderly (mock pass when `TENDERLY_*` creds are absent).
4. AgentExec submits a sponsored ERC-4337 UserOp (or mock settlement when `EXECUTION_MODE=mock`).

## Local demo

```bash
# API (repo root)
EXECUTION_MODE=mock npm run dev

# Website
cd website && npm run dev -- -p 3002
# open http://localhost:3002/demo
```

## Integration tests

```bash
npm test -- tests/integration/webmcp-agentexec.test.ts
```

## Environment

| Variable | Purpose |
|----------|---------|
| `AGENTEXEC_BASE_URL` / `NEXT_PUBLIC_AGENTEXEC_URL` | Gateway base URL (default `http://localhost:8787`) |
| `AGENT_API_KEY` / `NEXT_PUBLIC_AGENT_API_KEY` | `X-API-Key` header |
| `WEBMCP_PER_INTENT_CAP_USD` | Per-intent spend cap (default `10`) |
| `TENDERLY_ACCESS_KEY` / `TENDERLY_ACCOUNT_SLUG` / `TENDERLY_PROJECT_SLUG` | Live Tenderly pre-flight |
| `EXECUTION_MODE` | `mock` \| `live` |

## Related docs

- [WEBMCP_ADAPTER.md](./WEBMCP_ADAPTER.md) — adapter & intent route details
- [PITCH_DECK.md](./PITCH_DECK.md) — architecture overview
- [KEEPER_VERIFICATION.md](./KEEPER_VERIFICATION.md) — paymaster top-up keeper
