# AgentExec — Base L2 AI Transaction Provider

**The execution & security rail for the agentic economy.**

Standalone Base L2 API for AI agents: x402 HTTP paywalls, EIP-7579 session keys, Tenderly pre-flight safety, sponsored UserOps (Pimlico), and a Go Redis rate-limit gateway.

> This is **not** part of `vda-compliance`. Repo: [Har50/agent1](https://github.com/Har50/agent1).

## Docs

| Doc | Purpose |
|-----|---------|
| [Investor pitch](./docs/INVESTOR_PITCH.md) | Executive summary, stack diagram, GTM |
| [Architecture](./docs/ARCHITECTURE.md) | System design |
| [Website launch](./docs/WEBSITE_LAUNCH.md) | Portal strategy + hero copy |
| [MCP](./docs/MCP.md) | Cursor / Claude Desktop |
| [Production roadmap](./docs/PRODUCTION_ROADMAP.md) | Deploy checklist |
| [Master plan](./docs/MASTER_PLAN.md) | Product plan |
| [WebMCP SDK quickstart](./docs/SDK_QUICKSTART.md) | Browser → AgentExec adapter |
| [Executive pitch deck](./docs/PITCH_DECK.md) | One-page technical summary |

## Quick start (API)

```bash
npm install && npm test && npm run dev
# http://127.0.0.1:8787  ·  Swagger: /docs
```

```bash
# x402 sample paywall (protects /v1/paid/*)
X402_ENABLED=true \
X402_RECIPIENT=0xYourTreasury \
X402_PRICE_USDC=0.01 \
npm run dev
```

```bash
# Production stack
cp .env.example .env   # fill secrets
npm run prod:up        # docker compose -f docker-compose.prod.yml up -d --build
# Gateway: http://localhost:8080

# MCP (stdio → gateway)
API_BASE_URL=http://localhost:8080 AGENT_API_KEY=dev-agent-key npm run mcp
```

## Website (AgentExec landing)

```bash
cd website && npm install && npm run dev
# http://localhost:3001
```

## Middleware

- [`src/middleware/x402Paywall.ts`](./src/middleware/x402Paywall.ts) — HTTP 402 + `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE`
- [`src/middleware/simulateHook.ts`](./src/middleware/simulateHook.ts) — Tenderly gate before execute
