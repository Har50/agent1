# Production Launch Roadmap

Step-by-step path from the Fastify/viem foundation to a live Base launch.

## 1. Live E2E on Base Sepolia (do this first)

1. Create a free [Pimlico](https://dashboard.pimlico.io) API key → `PIMLICO_API_KEY`
2. Generate/fund an agent key with Base Sepolia ETH (faucet) → `AGENT_PRIVATE_KEY`
3. Configure:

```bash
cp .env.example .env
# BASE_NETWORK=baseSepolia
# EXECUTION_MODE=live
# PIMLICO_API_KEY=...
# AGENT_PRIVATE_KEY=0x...
```

4. Run:

```bash
npm run sepolia:check     # prints derived Safe address + explorer links
npm run sponsored:example # submits sponsored UserOp
```

5. Verify on [BaseScan Sepolia](https://sepolia.basescan.org) or [Jiffyscan](https://jiffyscan.xyz) that the agent EOA paid **0 ETH** gas.

## Tenderly middleware

`verifySimulationHook` (`src/middleware/simulateHook.ts`) runs as a Fastify `preHandler` on:

- `POST /v1/intent/execute` — dry-run → then Safe/Pimlico UserOp
- `POST /v1/intent/simulate-only` — dry-run only

```bash
curl -s http://127.0.0.1:8787/v1/intent/execute \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev-agent-key' \
  -d '{
    "fromAddress": "0xYourSafe",
    "targetAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "calldata": "0xa9059cbb...",
    "valueWei": "0",
    "maxAllowedDrainUSD": 50
  }'
```

Revert / drain → HTTP **422** (`TRANSACTION_REVERTED` | `BALANCE_DRAIN`) before any UserOp is signed.

## 3. Session keys (ERC-7579 / ZeroDev)

```bash
POST /v1/session-keys
{
  "id": "sk_agent1",
  "agentId": "claude-trader",
  "publicKey": "0xSessionSigner...",
  "maxSpendUsdc": 50,
  "spendWindowSeconds": 86400,
  "allowedTargets": ["0x2626664c2603336E57B271c5C0b26F421741e481"],
  "allowedSelectors": ["0x04e45aaf"],
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```

Scopes persist in Postgres (`session_keys` table). `SESSION_KEY_MODE=db|zerodev|off`.

Optional: set `ZERODEV_PROJECT_ID` and install `@zerodev/sdk` for Kernel v3 on-chain validators.

## 4. Go gateway + Redis rate limits

`docker compose up` starts Redis. Gateway env:

```
REDIS_URL=redis://redis:6379
RATE_LIMIT_PER_MIN=60
CIRCUIT_FAIL_LIMIT=10
CIRCUIT_WINDOW_SEC=60
```

Sliding-window per API key; ≥10 failures (422/5xx) in 60s opens the circuit.

## 5. Mainnet + hosted MCP

1. Fund Pimlico **mainnet** paymaster policy
2. `BASE_NETWORK=base` + production RPC
3. Deploy via `docker compose` (or Render / Fly / ECS)
4. Set `PUBLIC_BASE_URL=https://your-host` and run MCP:

```bash
npm run mcp              # stdio (Claude Desktop / Cursor)
npm run mcp:http         # HTTP transport for remote agents
```

Register tools: `execute_base_intent`, `simulate_base_intent`, `upsert_agent_session`, `issue_session_key`.
