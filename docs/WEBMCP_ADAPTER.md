# WebMCP Adapter + Provider

## Files

| Path | Role |
|------|------|
| `src/sdk/webmcp-adapter.ts` | Session-key signed x402 tool calls → `POST /v1/intent` |
| `website/src/components/WebMCPProvider.tsx` | Injects `navigator.modelContext` + `useWebMCP()` |
| `src/routes/intentRoute.ts` | Validates signature, spend cap, Tenderly pre-flight, UserOp/mock |
| `src/middleware/simulateHook.ts` | Re-exports `simulateTransaction` + Fastify Tenderly preHandler |

Uses **viem** (not ethers) to match the rest of AgentExec.

## API

```http
POST /v1/intent
X-API-Key: dev-agent-key
X-402-Payment-Signature: 0x...
X-402-Payment-Payload: {"tool":"...","amountUSD":0.1,...}
X-Session-Key-Address: 0x...
```

Alias: `POST /api/v1/intent`

| Header | Purpose |
|--------|---------|
| `X-402-Payment-Signature` | EIP-191 signature over payment payload JSON |
| `X-402-Payment-Payload` | JSON: tool, amountUSD, recipient, timestamp, nonce |
| `X-Session-Key-Address` | Expected session key address |

Per-intent cap: `WEBMCP_PER_INTENT_CAP_USD` (default `10`).

## Tenderly pre-flight

`simulateTransaction({ from, to, data, value?, networkId? })` posts to Tenderly’s simulate API before UserOp submission.
Without `TENDERLY_ACCESS_KEY` / `TENDERLY_ACCOUNT_SLUG` / `TENDERLY_PROJECT_SLUG` it returns a mock pass (`gasUsed: 120000`) for unit/CI.

## Demo

```bash
# API
EXECUTION_MODE=mock npm run dev

# Website
cd website && npm run dev -- -p 3002
# http://localhost:3002/demo
```

## Tests

```bash
npm test -- tests/integration/webmcp-agentexec.test.ts
```

Covers: Tenderly mock pass, valid 402 → SUCCESS, $10 spend-cap reject, 401 bad signature, 402 missing headers, plus SDK adapter E2E.
