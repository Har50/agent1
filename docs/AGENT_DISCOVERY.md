# Agent Discovery Assets

| Asset | Path | Purpose |
|-------|------|---------|
| Smithery | [`smithery.yaml`](../smithery.yaml) | Smithery.ai MCP server config schema |
| Glama | [`glama.json`](../glama.json) | Glama.ai MCP directory metadata |
| AGENTS.md | [`website/public/AGENTS.md`](../website/public/AGENTS.md) | Human/agent-readable domain interoperability |
| MCP discovery | [`website/public/.well-known/mcp.json`](../website/public/.well-known/mcp.json) | On-domain MCP endpoint discovery |
| A2A agent card | [`website/public/.well-known/agent-card.json`](../website/public/.well-known/agent-card.json) | Google A2A agent card |

Replace `yourdomain.com` / `api.yourdomain.com` with production URLs after Render deploy.

## Directory registration

1. **Glama.ai** — https://glama.ai/mcp — import `https://github.com/Har50/agent1`
2. **Smithery.ai** — https://smithery.ai — claim server with the GitHub repo link
3. **Official MCP Registry** — PR to `modelcontextprotocol/servers` / registry with your `.well-known/mcp.json` URL
