# Website Launch Strategy — AgentExec

## Positioning

**AgentExec** = sovereign execution layer for autonomous AI commerce on Base.

Badge: `BASE L2 • EIP-7579 • x402 PROTOCOL NATIVE`

## Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Framework | Next.js 14 (App Router) + TypeScript | SSR, docs, API routes |
| Styling | Tailwind CSS | High-signal developer marketing |
| Motion | CSS + Framer-lite keyframes | Hero rail / demo flow |
| Site path | `website/` in this repo | Ships beside the API |

## Launch sequence

1. Ship landing (`website/`) with hero, live demo strip, three pillars.
2. Link Docs → `/docs` (API Swagger) and MCP guide (`docs/MCP.md`).
3. Publish MCP config snippet for Claude Desktop / Cursor.
4. Soft-launch on Base Sepolia; promote mainnet when paymaster funded.

## Hero copy (canonical)

- **Headline:** Programmable Money Rails for Autonomous AI Agents.
- **Subhead:** Protect agent treasuries with Tenderly dry-runs, time-bounded session keys, and HTTP 402 micro-payment paywalls.
- **Primary CTA:** Connect MCP Server
- **Secondary CTA:** Read Docs & Architecture

## Wireframe

```
NAV: AgentExec | Docs | MCP | Pricing | Launch Portal
HERO: Brand → headline → one sentence → CTAs → full-bleed rail visual
DEMO: Intent → Tenderly Pass → UserOp (animated strip)
PILLARS: x402 | Session Keys | Go Gateway
```

Run locally:

```bash
cd website && npm install && npm run dev
# http://localhost:3001
```
