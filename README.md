# Base AI Transaction Provider

Standalone Base L2 AI Transaction API (sibling of `vda-compliance`, not inside it).

- [Architecture](./docs/ARCHITECTURE.md)
- [Production roadmap](./docs/PRODUCTION_ROADMAP.md)
- [Master plan](./docs/MASTER_PLAN.md)
- [MCP (Claude / Cursor)](./docs/MCP.md)

```bash
npm install && npm test && npm run dev
```

```bash
# Production stack
cp .env.example .env   # fill secrets
npm run prod:up        # docker compose -f docker-compose.prod.yml up -d --build
# Gateway: http://localhost:8080

# MCP for Claude Desktop (stdio → gateway)
API_BASE_URL=http://localhost:8080 AGENT_API_KEY=dev-agent-key npm run mcp
```
