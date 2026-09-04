# Production Deployment & Registration Workflow

End-to-end checklist: replace domain placeholders → set Render secrets → deploy → verify endpoints → register directories.

Related: [MAINNET_CHECKLIST.md](./MAINNET_CHECKLIST.md) · [RENDER_AND_MONITORING.md](./RENDER_AND_MONITORING.md) · [AGENT_DISCOVERY.md](./AGENT_DISCOVERY.md) · [`.env.production.example`](../.env.production.example)

---

## 1. Domain placeholder replacement

Update all `yourdomain.com` / `api.yourdomain.com` instances **before** building or deploying.

### Automated (recommended)

```bash
# Linux / macOS / Git Bash
chmod +x scripts/replace-production-domain.sh
./scripts/replace-production-domain.sh agentexec.io api.agentexec.io
```

```powershell
# Windows PowerShell (from repo root)
.\scripts\replace-production-domain.ps1 -SiteDomain agentexec.io -ApiDomain api.agentexec.io
```

### Files touched by the script

| Area | Paths |
|------|--------|
| Discovery & specs | `website/public/AGENTS.md`, `website/public/.well-known/mcp.json`, `website/public/.well-known/agent-card.json` |
| MCP manifests | `smithery.yaml` (`gatewayUrl` default) |
| Docs | `docs/AGENT_DISCOVERY.md`, `docs/RENDER_AND_MONITORING.md`, `docs/MAINNET_CHECKLIST.md`, `docs/PRODUCTION_DEPLOYMENT.md`, examples |

`glama.json`, `render.yaml`, `docker-compose.monitoring.yml`, and `monitoring/*` do **not** embed public domains today (Render URLs / secrets / local scrape targets). After deploy, set `NEXT_PUBLIC_AGENTEXEC_URL` on the website service to the live API host.

Review and commit:

```bash
git diff
git add -A
git commit -m "chore: set production domains for discovery assets"
git push origin main
```

---

## 2. Pre-deployment environment setup (Render)

Use the names this repo actually reads (see `render.yaml` and `.env.production.example`).

### Fastify gateway (`agentexec-gateway-api`)

| Variable | Required | Notes |
|----------|----------|--------|
| `PORT` | ✅ | `8787` |
| `HOST` | ✅ | `0.0.0.0` |
| `NODE_ENV` | ✅ | `production` |
| `CHAIN_ID` | ✅ | `8453` mainnet / `84532` Sepolia |
| `BASE_RPC_URL` | ✅ | Alchemy / QuickNode / Infura Base endpoint |
| `DATABASE_URL` | ✅ | Postgres |
| `REDIS_URL` | ✅ | Redis |
| `API_KEYS` | ✅ | Comma-separated `X-API-Key` values |
| `AGENT_PRIVATE_KEY` | ✅ | Agent / Safe owner EOA (session + UserOp path) |
| `PIMLICO_API_KEY` | ✅ | Gas sponsorship |
| `TENDERLY_ACCESS_KEY` | ✅ | Pre-flight simulation |
| `TENDERLY_ACCOUNT_SLUG` | ✅ | |
| `TENDERLY_PROJECT_SLUG` | ✅ | |
| `TENDERLY_REQUIRED` | ✅ | `true` in production |
| `X402_RECIPIENT` | ✅ | Treasury |
| `WEBMCP_PER_INTENT_CAP_USD` | ○ | Default `10` |
| `SENTRY_DSN` | ○ | |

> Aliases like `BASE_MAINNET_RPC_URL`, `TENDERLY_API_KEY`, or `SESSION_KEY_SIGNER_PRIVATE_KEY` are **not** read by this codebase — use the table above.

### Go keeper (`agentexec-go-keeper`)

| Variable | Required | Notes |
|----------|----------|--------|
| `BASE_RPC_URL` | ✅ | Same mainnet RPC family as API |
| `PAYMASTER_TOPUP_CONTRACT` | ✅ | Deployed `PaymasterAutoTopUp` address |
| `KEEPER_PRIVATE_KEY` | ✅ | Hot wallet with Base ETH for gas |
| `KEEPER_POLL_SECONDS` | ○ | Default `30` |
| `APP_ENV` | ○ | `production` |
| `SENTRY_DSN` | ○ | |
| `METRICS_PORT` | ○ | `9090` when metrics are exposed |

> On-chain `threshold` / `topUpAmount` are set at contract deploy (`TOPUP_THRESHOLD` / `TOPUP_AMOUNT`), not as `MIN_BALANCE_ETH` / `TOPUP_AMOUNT_ETH` env vars.

### Website (`agentexec-demo-playground`)

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_AGENTEXEC_URL` | ✅ Live Fastify URL |
| `NEXT_PUBLIC_AGENT_API_KEY` | ✅ |

### Monitoring stack (VPS / local compose)

| Variable / port | Value |
|-----------------|--------|
| Prometheus | `9090` |
| Alertmanager | `9300` |
| Grafana admin | set `GF_SECURITY_ADMIN_PASSWORD` (compose default is for local only — change it) |

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

---

## 3. Endpoint health verification

After Render deploy (and custom domains wired):

```bash
chmod +x scripts/verify-production-endpoints.sh
./scripts/verify-production-endpoints.sh https://yourdomain.com https://api.yourdomain.com
```

Or manually:

```bash
curl -I https://yourdomain.com/.well-known/mcp.json
curl -I https://yourdomain.com/.well-known/agent-card.json
curl -I https://yourdomain.com/AGENTS.md
curl https://api.yourdomain.com/health
```

Expect **HTTP 200** on all four.

---

## 4. Registry submissions

### Glama.ai

1. Open https://glama.ai/mcp  
2. Import repository: `https://github.com/Har50/agent1`  
3. Confirm `glama.json` metadata looks correct  

### Smithery.ai

```bash
npx @smithery/cli@latest publish
```

Or claim the server in the Smithery web console with the GitHub repo link (`smithery.yaml` at repo root).

### Official MCP Registry

1. Fork `modelcontextprotocol/registry` (or the current servers registry used by the MCP project).  
2. Add server metadata that references:

   `https://yourdomain.com/.well-known/mcp.json`

3. Open a Pull Request.  

---

## 5. Suggested order of operations

1. Run domain replace script with real hosts → commit → push `main`  
2. Fill Render Blueprint secrets (`render.yaml`) for gateway + keeper + website  
3. Deploy / wait for healthy `agentexec-gateway-api` `/health`  
4. Attach custom domains for site + API  
5. Run `verify-production-endpoints.sh`  
6. Submit Glama / Smithery / MCP registry  
7. Complete remaining items in [MAINNET_CHECKLIST.md](./MAINNET_CHECKLIST.md) (vault, USDC, keeper soak)
