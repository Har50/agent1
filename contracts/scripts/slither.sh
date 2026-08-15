#!/usr/bin/env bash
# Run Slither static analysis on PaymasterAutoTopUp.
# Requires: Python 3.10+, pip, Foundry (forge), and slither-analyzer.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v slither >/dev/null 2>&1; then
  echo "Slither not found. Install with:"
  echo "  python3 -m pip install --user slither-analyzer"
  echo "Or in a venv:"
  echo "  python3 -m venv .venv && source .venv/bin/activate && pip install slither-analyzer"
  exit 1
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "forge not found. Install Foundry: https://book.getfoundry.sh/getting-started/installation"
  exit 1
fi

# Ensure dependencies are present
if [[ ! -d lib/forge-std || ! -d lib/openzeppelin-contracts ]]; then
  echo "Missing lib deps — running forge install..."
  forge install
fi

ARGS=(
  .
  --compile-force-framework foundry
  --filter-paths "lib/|src/mocks/"
  --exclude-dependencies
)

# Optional: SARIF / JSON for CI
OUT_DIR="${SLITHER_OUT:-./slither-out}"
mkdir -p "$OUT_DIR"

echo "==> Slither (human-readable)"
slither "${ARGS[@]}" "$@"

echo ""
echo "==> Slither JSON report → ${OUT_DIR}/slither-report.json"
slither "${ARGS[@]}" --json "${OUT_DIR}/slither-report.json" || true

echo "Done. Review findings above before submitting for a third-party audit."
