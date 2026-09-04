#!/usr/bin/env bash
# Replace yourdomain.com placeholders before production build/deploy.
# Usage:
#   ./scripts/replace-production-domain.sh app.example.com api.example.com
#   SITE_DOMAIN=app.example.com API_DOMAIN=api.example.com ./scripts/replace-production-domain.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DOMAIN="${1:-${SITE_DOMAIN:-}}"
API_DOMAIN="${2:-${API_DOMAIN:-}}"

if [[ -z "$SITE_DOMAIN" || -z "$API_DOMAIN" ]]; then
  echo "Usage: $0 <site-domain> <api-domain>"
  echo "Example: $0 agentexec.io api.agentexec.io"
  exit 1
fi

# Strip accidental schemes
SITE_DOMAIN="${SITE_DOMAIN#https://}"
SITE_DOMAIN="${SITE_DOMAIN#http://}"
SITE_DOMAIN="${SITE_DOMAIN%/}"
API_DOMAIN="${API_DOMAIN#https://}"
API_DOMAIN="${API_DOMAIN#http://}"
API_DOMAIN="${API_DOMAIN%/}"

FILES=(
  website/public/AGENTS.md
  website/public/.well-known/mcp.json
  website/public/.well-known/agent-card.json
  smithery.yaml
  docs/AGENT_DISCOVERY.md
  docs/RENDER_AND_MONITORING.md
  docs/MAINNET_CHECKLIST.md
  docs/PRODUCTION_DEPLOYMENT.md
  docs/mcp-client.example.json
  docs/MASTER_PLAN.md
)

echo "Replacing placeholders:"
echo "  yourdomain.com     -> $SITE_DOMAIN"
echo "  api.yourdomain.com -> $API_DOMAIN"

changed=0
for rel in "${FILES[@]}"; do
  f="$ROOT/$rel"
  [[ -f "$f" ]] || continue
  if grep -q 'yourdomain\.com' "$f" 2>/dev/null; then
    # Replace longer API host first
    sed -i.bak \
      -e "s|api\.yourdomain\.com|${API_DOMAIN}|g" \
      -e "s|yourdomain\.com|${SITE_DOMAIN}|g" \
      "$f"
    rm -f "${f}.bak"
    echo "  updated $rel"
    changed=$((changed + 1))
  fi
done

# glama.json has no domain placeholder today; leave as-is
echo "Done. Files updated: $changed"
echo "Next: review git diff, commit, deploy Render, then verify endpoints."
