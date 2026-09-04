# AgentExec — Base Mainnet Production Checklist

Before transitioning from **Base Sepolia** to **Base Mainnet**, execute this verification protocol.

Related: [`.env.production.example`](../.env.production.example) · [`render.yaml`](../render.yaml) · [`KEEPER_VERIFICATION.md`](./KEEPER_VERIFICATION.md) · [`docker-compose.monitoring.yml`](../docker-compose.monitoring.yml)

---

## 1. Smart Contracts & Security

- [ ] `cd contracts && forge test --profile ci` green
- [ ] Extended fuzz: `forge test --fuzz-runs 10000`
- [ ] Slither: no unresolved High findings (`./scripts/slither.sh` or CI job)
- [ ] External audit engagement scheduled / completed
- [ ] Deploy `PaymasterAutoTopUp` to Base Mainnet (constructor: `token`, `paymaster`, `keeper`, `threshold`, `topUpAmount`):

```bash
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export PAYMASTER_ADDRESS=0xYourPimlicoOrTreasuryPaymaster
export KEEPER_ADDRESS=0xYourKeeperHotWallet
export TOPUP_THRESHOLD=100000000   # $100 (6 decimals)
export TOPUP_AMOUNT=50000000       # $50
export DEPLOYER_PRIVATE_KEY=0x...  # cold / multisig deployer — never commit

cd contracts

# Preferred: Foundry script
forge script script/DeployPaymasterAutoTopUp.s.sol:DeployPaymasterAutoTopUp \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key "$BASESCAN_API_KEY"

# Or forge create
forge create --rpc-url https://mainnet.base.org \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --verify \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  src/PaymasterAutoTopUp.sol:PaymasterAutoTopUp \
  --constructor-args "$USDC_ADDRESS" "$PAYMASTER_ADDRESS" "$KEEPER_ADDRESS" "$TOPUP_THRESHOLD" "$TOPUP_AMOUNT"
```

- [ ] Verify source is public on BaseScan
- [ ] Transfer ownership to Timelock or Safe multisig (`transferOwnership`)
- [ ] Record mainnet vault address in ops runbook / Render `PAYMASTER_TOPUP_CONTRACT`

---

## 2. Treasury & Allowances

- [ ] Treasury holds Base mainnet USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- [ ] From the funding account, `approve` the vault, then `deposit`:

```bash
# Example (cast) — amounts in USDC 6 decimals
cast send "$USDC_ADDRESS" "approve(address,uint256)" "$PAYMASTER_TOPUP_CONTRACT" \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url https://mainnet.base.org --private-key "$TREASURY_PRIVATE_KEY"

cast send "$PAYMASTER_TOPUP_CONTRACT" "deposit(uint256)" 500000000 \
  --rpc-url https://mainnet.base.org --private-key "$TREASURY_PRIVATE_KEY"
```

- [ ] Confirm `pause` / `withdraw` with owner in a controlled drill
- [ ] Document who holds owner keys (preferably multisig / cold)

---

## 3. Go Keeper Daemon Setup

- [ ] Fund the keeper hot wallet with native Base ETH (~**0.02–0.05 ETH** for execution gas)
- [ ] On-chain `setKeeper(keeperAddress)` if not set in constructor
- [ ] Update Render worker (`agentexec-go-keeper`) env:

| Variable | Value |
|----------|--------|
| `BASE_RPC_URL` | Alchemy / QuickNode / Infura Base **mainnet** |
| `PAYMASTER_TOPUP_CONTRACT` | Newly deployed mainnet vault |
| `KEEPER_PRIVATE_KEY` | Dedicated hot wallet (secret) |
| `KEEPER_POLL_SECONDS` | `30` (or as needed) |
| `APP_ENV` | `production` |
| `SENTRY_DSN` | Optional error reporting |

- [ ] Confirm process supervisor: Render worker / systemd `Restart=always` / Docker restart policy
- [ ] Bring up local/VPS monitoring: `docker compose -f docker-compose.monitoring.yml up -d`
- [ ] Verify Sentry (or logs) captures errors via a controlled dry-run / bad RPC test, then restore config

---

## 4. Fastify Gateway & WebMCP SDK

- [ ] Set `CHAIN_ID=8453` and `BASE_NETWORK=base` on `agentexec-gateway-api`
- [ ] Live `PIMLICO_API_KEY` + Tenderly (`TENDERLY_*`, `TENDERLY_REQUIRED=true`)
- [ ] Postgres + Redis production URLs
- [ ] Rotate `API_KEYS`; set `X402_RECIPIENT` to production treasury
- [ ] Point Next.js `NEXT_PUBLIC_AGENTEXEC_URL` at the live Render API URL (see `render.yaml`)
- [ ] E2E: session-key signed `POST /v1/intent` + Tenderly pre-flight against **live mainnet** state
- [ ] Rate limits + spend cap (`WEBMCP_PER_INTENT_CAP_USD`) confirmed

---

## 5. Render Blueprint deploy

```bash
# From repo root — connect the Blueprint in Render dashboard, or:
# https://dashboard.render.com → New → Blueprint → select this repo (render.yaml)
```

Services created:

1. `agentexec-demo-playground` — Next.js WebMCP demo  
2. `agentexec-gateway-api` — Fastify (`/health`)  
3. `agentexec-go-keeper` — background worker  

Fill all `sync: false` secrets before switching traffic.

---

## 6. Go-live gate

- [ ] Sepolia soak ≥ 24h with keeper auto top-ups observed
- [ ] Mainnet deploy dry-run checklist signed off
- [ ] Incident runbook linked from [KEEPER_VERIFICATION.md](./KEEPER_VERIFICATION.md)
- [ ] Monitoring alerts routed to Slack / PagerDuty (edit `monitoring/alertmanager.yml`)

---

## `.env.production` template

Copy to a secrets manager or local `.env.production` (never commit real keys).

See [`.env.production.example`](../.env.production.example).
