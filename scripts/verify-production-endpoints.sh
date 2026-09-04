#!/usr/bin/env bash
# Verify production discovery + API health endpoints return HTTP 200.
# Usage:
#   ./scripts/verify-production-endpoints.sh https://yourdomain.com https://api.yourdomain.com
set -euo pipefail

SITE_BASE="${1:-}"
API_BASE="${2:-}"

if [[ -z "$SITE_BASE" || -z "$API_BASE" ]]; then
  echo "Usage: $0 <site-base-url> <api-base-url>"
  echo "Example: $0 https://agentexec.io https://api.agentexec.io"
  exit 1
fi

SITE_BASE="${SITE_BASE%/}"
API_BASE="${API_BASE%/}"

check() {
  local url="$1"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" -L "$url" || echo "000")
  if [[ "$code" == "200" ]]; then
    echo "OK  $code  $url"
  else
    echo "FAIL $code  $url"
    return 1
  fi
}

fail=0
check "$SITE_BASE/.well-known/mcp.json" || fail=1
check "$SITE_BASE/.well-known/agent-card.json" || fail=1
check "$SITE_BASE/AGENTS.md" || fail=1
check "$API_BASE/health" || fail=1

exit "$fail"
