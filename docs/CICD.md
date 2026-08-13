# CI/CD — AgentExec

GitHub Actions workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

## Jobs

| Job | What | Deploy target |
|-----|------|----------------|
| `go-gateway-ci` | `go test ./...` in `gateway/` | Render deploy hook on `main` |
| `api-ci` | `npm test` + `npm run typecheck` | — |
| `nextjs-portal-ci` | `tsc` + `npm run build` in `website/` | Vercel preview (PR) / prod (`main`) |

## Secrets

Add under **Settings → Secrets and variables → Actions**:

| Secret | Service | Purpose |
|--------|---------|---------|
| `RENDER_GATEWAY_DEPLOY_HOOK` | Render | Deploy hook URL from Render service settings |
| `VERCEL_TOKEN` | Vercel | Token from [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel | From `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Vercel | From `.vercel/project.json` |

If `RENDER_GATEWAY_DEPLOY_HOOK` is unset, the Render step skips (tests still run).
Vercel deploy steps fail until Vercel secrets are configured — add them before merging deploy-on-main.
