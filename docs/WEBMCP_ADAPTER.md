# WebMCP Adapter + Provider

## Files

| Path | Role |
|------|------|
| `src/sdk/webmcp-adapter.ts` | Session-key signed x402 tool calls → `POST /v1/intent` |
| `website/src/components/WebMCPProvider.tsx` | Injects `navigator.modelContext` + `useWebMCP()` |
| `src/routes/intentRoute.ts` | Validates signature, spend cap, runs UserOp/mock |

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

Per-intent cap: `WEBMCP_PER_INTENT_CAP_USD` (default `10`).

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
npm test -- tests/integration/webmcp-intent.test.ts
```
