# MCP Server — Claude / Cursor / AutoGPT

The MCP process is a thin stdio client that calls your **Go gateway** (or Fastify) over HTTP.

## Tools

| Tool | API |
|------|-----|
| `execute_onchain_intent` | `POST /v1/intent/execute` |
| `dry_run_simulation` | `POST /v1/intent/simulate-only` |
| `get_smart_account_info` | `GET /v1/account` |
| `issue_session_key` | `POST /v1/session-keys/issue` |

## Run locally

```bash
# Terminal A — stack
docker compose -f docker-compose.prod.yml up -d --build

# Terminal B — MCP stdio (Claude Desktop)
API_BASE_URL=http://localhost:8080 AGENT_API_KEY=dev-agent-key npm run mcp
```

## Claude Desktop

Copy `docs/claude_desktop_config.example.json` into Claude’s config and set the absolute path to `dist/mcp/server.js` after `npm run build`.

## Cursor / remote HTTP agents

Point at the gateway REST API directly, or use the MCP stdio bridge above.
