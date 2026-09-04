#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   AGENT_API_KEY=your-key ./scripts/test-intent.sh
#   GATEWAY_URL=https://api.agentexec.dev/api/v1/intent AGENT_API_KEY=... ./scripts/test-intent.sh
#
# Endpoint configuration
GATEWAY_URL="${GATEWAY_URL:-https://api.agentexec.dev/api/v1/intent}"
API_KEY="${AGENT_API_KEY:-${API_KEY:-}}"

# Terminal color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE} AgentExec WebMCP Intent Execution Test${NC}"
echo -e "${BLUE} Target Endpoint: ${GATEWAY_URL}${NC}"
echo -e "${BLUE}======================================================${NC}"
echo

# Portable curl capture (works without GNU head -n -1)
curl_json() {
  local tmp
  tmp=$(mktemp)
  local code
  code=$(curl -sS -o "$tmp" -w "%{http_code}" --max-time 20 "$@" || echo "000")
  BODY=$(cat "$tmp")
  rm -f "$tmp"
  HTTP_CODE="$code"
}

print_body() {
  if command -v jq >/dev/null 2>&1; then
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  else
    echo "$BODY"
  fi
}

# Body shape expected by POST /api/v1/intent (WebMCP route)
INTENT_PAYLOAD=$(cat <<'EOF'
{
  "toolName": "purchase_premium_data",
  "targetContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "abiMethod": "fetchData()",
  "args": { "endpoint": "/analytics" }
}
EOF
)

# 1. x402 handshake — with API key, without payment headers → expect 402
echo -e "${YELLOW}[1/2] Testing x402 Handshake (expecting HTTP 402 Payment Required)...${NC}"
if [ -z "$API_KEY" ]; then
  echo -e "${YELLOW}hint: set AGENT_API_KEY to pass API auth and assert 402 (without it you get 401).${NC}"
  curl_json -X POST "$GATEWAY_URL" \
    -H "Content-Type: application/json" \
    -d "$INTENT_PAYLOAD"
else
  curl_json -X POST "$GATEWAY_URL" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "$INTENT_PAYLOAD"
fi

echo "HTTP Response Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "402" ]; then
  echo -e "${GREEN}✓ Correctly received HTTP 402 Payment Required from gateway.${NC}"
  print_body
elif [ "$HTTP_CODE" = "401" ]; then
  echo -e "${YELLOW}○ HTTP 401 — provide AGENT_API_KEY to reach the x402 layer.${NC}"
  print_body
elif [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Gateway accepted intent directly (HTTP 200 OK).${NC}"
  print_body
else
  echo -e "${RED}✗ Unexpected response status: $HTTP_CODE${NC}"
  print_body
fi
echo

# 2. Intent with mock session / payment headers (invalid sig → 401 Unauthorized at verify)
echo -e "${YELLOW}[2/2] Sending Intent with Session Key Authorization & Payment Proof...${NC}"

PAYMENT_PAYLOAD=$(cat <<'EOF'
{"tool":"purchase_premium_data","amountUSD":0.1,"recipient":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","timestamp":0,"nonce":"0x01"}
EOF
)
MOCK_SESSION_SIG="0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001b"
SESSION_ADDR="0x1111111111111111111111111111111111111111"

HDRS=(
  -H "Content-Type: application/json"
  -H "X-402-Payment-Signature: $MOCK_SESSION_SIG"
  -H "X-402-Payment-Payload: $PAYMENT_PAYLOAD"
  -H "X-Session-Key-Address: $SESSION_ADDR"
)
if [ -n "$API_KEY" ]; then
  HDRS+=(-H "X-API-Key: $API_KEY")
fi

curl_json -X POST "$GATEWAY_URL" "${HDRS[@]}" -d "$INTENT_PAYLOAD"

echo "HTTP Response Status: $HTTP_CODE"
print_body

if [ -z "$API_KEY" ] && [ "$HTTP_CODE" = "401" ]; then
  echo -e "${YELLOW}○ HTTP 401 — set AGENT_API_KEY (must match Render API_KEYS) then re-run.${NC}"
elif [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Gateway rejected invalid session signature (expected for mock sig).${NC}"
elif [ "$HTTP_CODE" = "402" ]; then
  echo -e "${YELLOW}○ Still 402 — check payment header names.${NC}"
elif [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Execution succeeded (unexpected with mock sig unless mock mode is very loose).${NC}"
fi

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE} Intent test execution sequence complete.${NC}"
echo -e "${BLUE}======================================================${NC}"
