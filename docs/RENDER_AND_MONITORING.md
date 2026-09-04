# Render + Observability Deploy

## Render Blueprint

Root [`render.yaml`](../render.yaml) deploys:

| Service | Type | Role |
|---------|------|------|
| `agentexec-demo-playground` | web | Next.js WebMCP demo (`website/`) |
| `agentexec-gateway-api` | web | Fastify API (`node dist/server.js`, `/health`) |
| `agentexec-go-keeper` | worker | Paymaster top-up daemon (`gateway/cmd/keeper`) |

1. Push this branch to GitHub.
2. Render → **New** → **Blueprint** → select `Har50/agent1`.
3. Set all `sync: false` secrets (RPC, keys, Tenderly, Pimlico, DB, Redis).
4. Replace domain placeholders and verify endpoints — [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md).
5. For mainnet cutover follow [MAINNET_CHECKLIST.md](./MAINNET_CHECKLIST.md).

## Local monitoring stack

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

| UI | URL | Default login |
|----|-----|----------------|
| Grafana | http://localhost:3000 | `admin` / `agentexec_secret` |
| Prometheus | http://localhost:9090 | — |
| Alertmanager | http://localhost:9300 | — |

Configs live under `monitoring/`. Point Alertmanager’s webhook at Slack/Discord/PagerDuty before production.
