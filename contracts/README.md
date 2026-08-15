# Smart Contract Testing & Static Analysis

This package contains `PaymasterAutoTopUp.sol` — the USDC vault that tops up a
paymaster when its balance drops below a threshold.

## Prerequisites

```bash
# Foundry (forge / cast / anvil)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Dependencies (from contracts/)
cd contracts
forge install
```

## Foundry unit, fuzz & invariant tests

```bash
cd contracts

# Full suite (unit + fuzz + invariants)
forge test -vv

# Match a single test
forge test --match-test test_executeTopUp_keeperSucceeds -vvvv

# Fuzz / invariant with more runs (CI profile)
forge test --profile ci -vv

# Gas report
forge test --gas-report
```

### What the suite covers

| Area | File | Verifies |
|------|------|----------|
| Constructor / config | `PaymasterAutoTopUp.t.sol` | Zero-address & zero-config reverts |
| Access control | same | `onlyKeeperOrOwner`, Ownable withdraw/admin |
| Deposit / withdraw | same | ERC-20 transfers, events, pause |
| `executeTopUp` | same | Threshold gate, vault shortfall, multi top-up |
| Fuzz | same | Random deposits, withdrawals, unauthorized callers |
| Invariants | `PaymasterAutoTopUp.invariant.t.sol` | Token conservation; top-up accounting; owner sticky |

### Invariants under stress

```text
INITIAL + deposits = vault_balance + withdrawals + topped_up
totalToppedUp == topUpCount * topUpAmount
owner never changes via handler actions
```

## Slither static analysis

[Slither](https://github.com/crytic/slither) is a Solidity static analyzer used
**before** submitting contracts to a third-party audit (OpenZeppelin, Trail of Bits,
Cyfrin, CertiK, Sherlock, etc.).

### Install

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install slither-analyzer solc-select

# Slither uses Foundry's build; ensure forge works first
forge build
```

### Run

```bash
cd contracts

# Helper script (recommended)
chmod +x scripts/slither.sh
./scripts/slither.sh

# Or directly
slither . --compile-force-framework foundry \
  --filter-paths "lib/|src/mocks/" \
  --exclude-dependencies
```

JSON report (CI artifact):

```bash
mkdir -p slither-out
slither . --compile-force-framework foundry \
  --filter-paths "lib/|src/mocks/" \
  --exclude-dependencies \
  --json slither-out/slither-report.json
```

Config lives in `slither.config.json`.

### Interpreting results

1. Fix **High / Medium** findings before audit submission.
2. Triage **Low / Informational** (document intentional patterns).
3. Re-run after every contract change; keep the JSON report with audit packages.

### Complementary scanners (optional)

```bash
# Solhint (style / common pitfalls)
npm i -g solhint
solhint 'src/**/*.sol'

# Mythril (symbolic execution) — slower, optional
pip install mythril
myth analyze src/PaymasterAutoTopUp.sol --solc-json mythril.json
```

## Suggested pre-mainnet checklist

1. `forge test --profile ci` green
2. `./scripts/slither.sh` with no unresolved High/Medium
3. Foundry fuzz / invariant runs ≥ CI profile
4. External audit report + remediation PR
5. Deploy to Base Sepolia → keeper integration test → mainnet

## Deploy (example)

```bash
forge script script/DeployPaymasterAutoTopUp.s.sol:DeployPaymasterAutoTopUp \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --verify
```

See `docs/SMART_CONTRACT_AUDIT.md` in the repo root for the broader audit /
QA / compliance map.
