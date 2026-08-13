# Base L2 AI Transaction Provider

Hybrid **TypeScript execution service** + optional **Go API gateway** for AI agents that need to submit gas-sponsored transactions on Base (ERC-4337 / Account Abstraction).

```
Client / AI Agent
      │  REST / MCP / WebSocket
      ▼
Go API Gateway          (auth, rate-limit, proxy)     [optional]
      │  HTTP
      ▼
TS Execution Service    (intent → zod → simulate → UserOp)
      │
      ├── Base L2 RPC / Bundler / Paymaster
      └── Postgres / Redis (sessions, tx log)
```

## Quick start

```bash
cd base-ai-tx-provider
cp .env.example .env
npm install
npm test
npm run dev          # http://127.0.0.1:8787  ·  docs at /docs
```

Optional Go gateway:

```bash
cd gateway && go run .   # :8080 → execution :8787
```

Docker (Postgres + Redis + execution + gateway):

```bash
docker compose up --build
```

## Intent → UserOp flow

1. **Receive** — agent POSTs `/v1/intents` or calls MCP tool `execute_base_intent`
2. **Validate** — `zod` schemas enforce typed swap / transfer / approve / custom params
3. **Resolve** — encode against Uniswap v3 / ERC-20 ABIs via `viem`
4. **Guardrails** — session spend caps + target allowlists
5. **Simulate** — `eth_estimateGas` / Tenderly (when configured)
6. **Execute** — ERC-4337 UserOperation via Safe + Pimlico paymaster (or EOA / mock)

Safety inserts **before step 6**: Tenderly (or viem) balance-delta + revert checks → HTTP 422 on failure.
Session keys (ERC-7579 scopes in Postgres) enforce spend caps / target / selector allowlists.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness (no auth) |
| GET | `/v1/meta` | Chain constants & capabilities |
| POST | `/v1/intents` | Validate + simulate/execute |
| POST | `/v1/intents/simulate` | Force dry-run |
| GET | `/v1/intents/:intentId` | Lookup result |
| POST | `/v1/sessions` | Upsert agent session limits |

Auth: `X-API-Key` or `Authorization: Bearer <key>` (see `API_KEYS`).

### Example

```bash
curl -s http://127.0.0.1:8787/v1/intents \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev-agent-key' \
  -d '{
    "kind": "swap",
    "agentId": "claude-trader",
    "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "tokenOut": "0x4200000000000000000000000000000000000006",
    "amountIn": "50",
    "recipient": "0xYourSmartAccount",
    "dryRun": true
  }'
```

## MCP tools

```bash
npm run mcp
```

Tools: `execute_base_intent`, `simulate_base_intent`, `upsert_agent_session`.

## Sponsored transactions (Safe + Pimlico)

Production path uses **permissionless.js** + **viem** exactly as in `scripts/executeSponsoredTx.ts`:

| Piece | Role |
|-------|------|
| `toSafeSmartAccount` | ERC-4337 counterfactual Safe v1.4.1; auto-deploys on first sponsored UserOp |
| `createPimlicoClient` / `paymaster` | Requests paymaster signature — agent pays **0 ETH** gas |
| `createSmartAccountClient.sendTransaction` | Turns `{ to, data, value }` into a signed UserOperation → bundler → Base EntryPoint |

Flow:

1. Owner EOA (`AGENT_PRIVATE_KEY`) signs
2. **Safe Smart Account** is the ERC-4337 sender
3. **Pimlico paymaster** sponsors gas
4. Bundler includes the UserOp; receipt is polled on Base

```bash
# .env
AGENT_PRIVATE_KEY=0x...
PIMLICO_API_KEY=...          # https://dashboard.pimlico.io
BASE_NETWORK=base            # or baseSepolia
BASE_RPC_URL=https://mainnet.base.org
EXECUTION_MODE=live

npm run sponsored:example    # standalone USDC transfer demo
```

Wired into the API: `EXECUTION_MODE=live` + keys above → `/v1/intents` uses `sendSponsoredTransaction` in `src/services/safeAccount.ts`.

`GET /v1/account` returns the owner EOA and counterfactual Safe address.


## Stack

- **Execution:** Node 22+, Fastify, viem, permissionless, zod, drizzle-orm, MCP SDK
- **Gateway (optional):** Go `net/http` reverse proxy + in-memory rate limit
- **Data:** Postgres 16 (sessions / tx log), Redis (gateway sessions)

## Repo layout

```
base-ai-tx-provider/
  src/           TS execution + MCP
  gateway/       Go ingress
  tests/         vitest
  docker-compose.yml
```
