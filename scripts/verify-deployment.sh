#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/verify-deployment.sh <domain> [api_domain]
# Example: ./scripts/verify-deployment.sh agentexec.io api.agentexec.io
#
# Optional: set AGENT_API_KEY (or VERIFY_API_KEY) so the intent route is
# probed with auth and expected to return HTTP 402 Payment Required.
# Without a key, the same route is expected to return HTTP 401.

DOMAIN="${1:-}"
API_DOMAIN="${2:-}"

if [ -z "$DOMAIN" ]; then
  echo "Error: Main domain required."
  echo "Usage: $0 <domain> [api_domain]"
  echo "Example: $0 agentexec.io api.agentexec.io"
  exit 1
fi

# Strip accidental schemes / trailing slashes
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%/}"
if [ -z "$API_DOMAIN" ]; then
  API_DOMAIN="api.$DOMAIN"
else
  API_DOMAIN="${API_DOMAIN#https://}"
  API_DOMAIN="${API_DOMAIN#http://}"
  API_DOMAIN="${API_DOMAIN%/}"
fi

API_KEY="${AGENT_API_KEY:-${VERIFY_API_KEY:-}}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
FAILED=0

echo "=========================================="
echo " Post-Deployment Verification"
echo " Web Domain : $DOMAIN"
echo " API Domain : $API_DOMAIN"
echo "=========================================="
echo

check_ssl() {
  local host="$1"
  echo -n "[SSL] Checking certificate for $host... "
  local expiry_date
  expiry_date=$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)
  if [ -z "$expiry_date" ]; then
    echo -e "${RED}FAILED${NC} (Could not establish SSL connection)"
    FAILED=1
    return
  fi
  local expiry_epoch=0
  if date -d "$expiry_date" +%s >/dev/null 2>&1; then
    expiry_epoch=$(date -d "$expiry_date" +%s)
  elif date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s >/dev/null 2>&1; then
    expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s)
  fi
  local now_epoch
  now_epoch=$(date +%s)
  local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
  if [ "$expiry_epoch" -eq 0 ]; then
    echo -e "${YELLOW}WARN${NC} (Cert present; could not parse expiry: $expiry_date)"
  elif [ "$days_left" -lt 7 ]; then
    echo -e "${RED}FAILED${NC} (Expires in $days_left days on $expiry_date)"
    FAILED=1
  else
    echo -e "${GREEN}PASSED${NC} (Valid for $days_left days until $expiry_date)"
  fi
}

# Portable: split body / status without GNU head -n -1
curl_capture() {
  local url="$1"
  shift
  local tmp
  tmp=$(mktemp)
  local code
  code=$(curl -sS -o "$tmp" -w "%{http_code}" --max-time 15 "$@" "$url" || echo "000")
  BODY=$(cat "$tmp")
  rm -f "$tmp"
  HTTP_CODE="$code"
}

check_endpoint() {
  local url="$1"
  local expected_code="${2:-200}"
  local check_json="${3:-false}"
  shift 3 || true

  echo -n "[HTTP] GET $url... "
  curl_capture "$url" "$@"
  if [ "$HTTP_CODE" != "$expected_code" ]; then
    echo -e "${RED}FAILED${NC} (Got HTTP $HTTP_CODE, expected $expected_code)"
    FAILED=1
    return
  fi
  if [ "$check_json" = "true" ]; then
    if command -v jq >/dev/null 2>&1; then
      if echo "$BODY" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC} (HTTP $HTTP_CODE - Valid JSON)"
      else
        echo -e "${RED}FAILED${NC} (HTTP $HTTP_CODE - Invalid JSON syntax)"
        FAILED=1
      fi
    else
      # Minimal JSON sanity without jq
      if echo "$BODY" | grep -q '[{[]'; then
        echo -e "${GREEN}PASSED${NC} (HTTP $HTTP_CODE - JSON-like body; install jq for strict check)"
      else
        echo -e "${RED}FAILED${NC} (HTTP $HTTP_CODE - body does not look like JSON)"
        FAILED=1
      fi
    fi
  else
    echo -e "${GREEN}PASSED${NC} (HTTP $HTTP_CODE)"
  fi
}

check_intent_paywall() {
  local url="https://$API_DOMAIN/api/v1/intent"
  local expected headers=(-X POST -H "Content-Type: application/json" -d '{}')

  if [ -n "$API_KEY" ]; then
    expected=402
    headers+=(-H "X-API-Key: $API_KEY")
    echo -n "[HTTP] POST $url (expect 402 Payment Required)... "
  else
    expected=401
    echo -n "[HTTP] POST $url (expect 401 without API key)... "
    echo -e "\n${YELLOW}hint:${NC} set AGENT_API_KEY to assert the x402 paywall (402) instead"
  fi

  curl_capture "$url" "${headers[@]}"
  if [ "$HTTP_CODE" != "$expected" ]; then
    echo -e "${RED}FAILED${NC} (Got HTTP $HTTP_CODE, expected $expected)"
    FAILED=1
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    if echo "$BODY" | jq . >/dev/null 2>&1; then
      echo -e "${GREEN}PASSED${NC} (HTTP $HTTP_CODE - Valid JSON)"
    else
      echo -e "${RED}FAILED${NC} (HTTP $HTTP_CODE - Invalid JSON)"
      FAILED=1
    fi
  else
    echo -e "${GREEN}PASSED${NC} (HTTP $HTTP_CODE)"
  fi
}

# 1. Check SSL Certificates
echo "--- SSL Certificate Checks ---"
check_ssl "$DOMAIN"
check_ssl "$API_DOMAIN"
echo

# 2. Check Discovery Assets
echo "--- Public Discovery Manifests ---"
check_endpoint "https://$DOMAIN/AGENTS.md" 200 false
check_endpoint "https://$DOMAIN/.well-known/mcp.json" 200 true
check_endpoint "https://$DOMAIN/.well-known/agent-card.json" 200 true
echo

# 3. Check Gateway & x402 Route Health
echo "--- Gateway & Health Routes ---"
check_endpoint "https://$API_DOMAIN/health" 200 true
check_intent_paywall
echo

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✓ All post-deployment checks passed successfully!${NC}"
  exit 0
else
  echo -e "${RED}✗ Post-deployment verification failed.${NC}"
  exit 1
fi
