# Website Launch Strategy — AgentExec

## Positioning

**AgentExec** = foundational execution, security, and micropayment layer for AI agents
(analogous to Helius for Solana RPC — but for agent commerce rails).

See [ECOSYSTEM_POSITIONING.md](./ECOSYSTEM_POSITIONING.md) for the full vertical matrix.

Badge: `BASE L2 • EIP-7579 • x402 PROTOCOL NATIVE`

## Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Framework | Next.js 14 (App Router) + TypeScript | SSR + marketing |
| Styling | Tailwind CSS | High-density developer aesthetic |
| Icons | Lucide | Use-case + playground UI |
| Motion | Framer Motion | Hero / section presence |
| Site path | `website/` | Ships beside the API |

## Page architecture

1. **Hero** — AgentExec brand, one headline, one supporting line, CTAs
2. **Code playground** — MCP / x402 / TypeScript SDK tabs (interactive)
3. **Telemetry band** — latency / gas / simulation / x402
4. **Use cases** — Trading, Commerce, DeFi, Banking, Compute, DAO
5. **Architecture** — Intent → Gateway → Tenderly → Base settlement
6. **x402** — protocol explainer + middleware link

## Hero copy

- **Headline:** AgentExec — Execution & money rails for autonomous AI
- **Subhead:** Session-key spend limits, Tenderly dry-runs, Go rate limiting, x402 micropayments
- **Primary CTA:** Start Building Free
- **Secondary CTA:** Explore Industry Use Cases

```bash
cd website && npm install && npm run dev
# http://localhost:3001
```
