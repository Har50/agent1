# Master Plan — Complete Backlog

All work lives in `base-ai-tx-provider/` (not `vda-compliance/`).

## Phase 1 — Base Sepolia E2E

```bash
cp .env.example .env
# CHAIN_ID=84532
# BASE_RPC_URL=https://sepolia.base.org
# AGENT_PRIVATE_KEY / PIMLICO_API_KEY / TENDERLY_* 

npm run sepolia:check
# Fund owner EOA with ~0.005 Sepolia ETH
# Fund Safe (from GET /v1/account) with Sepolia USDC 0x036CbD53842c5426634e7929541eC2318f3dCF7e

EXECUTION_MODE=live npm run sponsored:example
```

Checklist:
- [ ] Tenderly PASSED in logs before UserOp
- [ ] Valid UserOp / tx hash returned
- [ ] BaseScan Sepolia shows 0 ETH gas on Safe (Pimlico sponsored)

## Phase 2 — ERC-7579 session keys

```bash
# Generate ephemeral key (24h, ≤50 USDC transfer, USDC-only)
curl -s localhost:8787/v1/session-keys/issue \
  -H 'x-api-key: dev-agent-key' -H 'content-type: application/json' \
  -d '{"agentId":"claude-trader","maxUsdc":50,"ttlHours":24}'
```

`SESSION_KEY_MODE=zerodev` builds Kernel v3 validator via `@zerodev/session-key`.
`/v1/intent/execute` enforces scopes before UserOp (`SESSION_KEY_VIOLATION` → 422).

## Phase 3 — Go gateway + Redis

Already in `docker-compose.yml` / `docker-compose.prod.yml`.
Sliding-window + circuit breaker: `gateway/middleware/ratelimit.go`.

## Phase 4 — Mainnet + MCP

```bash
# .env: CHAIN_ID=8453 BASE_RPC_URL=https://mainnet.base.org EXECUTION_MODE=live
# Fund Pimlico mainnet paymaster
docker compose -f docker-compose.prod.yml up -d --build
```

Register MCP (see `docs/mcp-client.example.json`):

```json
{
  "mcpServers": {
    "base-tx-provider": {
      "url": "https://api.yourdomain.com/mcp",
      "headers": { "X-API-Key": "YOUR_AGENT_API_KEY" }
    }
  }
}
```
