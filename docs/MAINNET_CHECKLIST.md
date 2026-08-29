# AgentExec — Base Mainnet Production Checklist

## `.env.production` template

Copy to a **secrets manager** or local `.env.production` (never commit real keys).

See also: [`.env.production.example`](../.env.production.example)

---

## Pre-flight checklist

### Smart contract security

- [ ] `cd contracts && forge test --profile ci` green
- [ ] `forge test --fuzz-runs 10000` (extended fuzz)
- [ ] `./scripts/slither.sh` — no unresolved High findings
- [ ] External audit engagement (OpenZeppelin / Trail of Bits / Cyfrin / etc.)
- [ ] Deploy `PaymasterAutoTopUp` on Base mainnet
- [ ] `forge verify-contract` on BaseScan
- [ ] Record mainnet vault address in ops runbook

### Keeper operational health

- [ ] Dedicated keeper hot wallet funded with **~0.05 ETH on Base mainnet**
- [ ] `setKeeper(keeperAddress)` called by owner
- [ ] `PAYMASTER_TOPUP_CONTRACT` = mainnet vault
- [ ] `BASE_RPC_URL` = mainnet (Alchemy/QuickNode recommended + fallback)
- [ ] Process supervisor: Render / systemd `Restart=always` / Docker restart policy
- [ ] Prometheus metrics + alerts when paymaster reserve &lt; threshold
- [ ] Sentry (or equivalent) on keeper + API

### Treasury & allowances

- [ ] Treasury holds USDC on Base mainnet (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- [ ] Owner `approve` + `deposit` into vault (or ongoing funding policy)
- [ ] Confirm `pause` / `withdraw` with owner key in a controlled drill
- [ ] Document who holds owner key (preferably multisig / cold)

### API / execution rail

- [ ] `CHAIN_ID=8453`, live Pimlico + Tenderly credentials
- [ ] Postgres + Redis production instances
- [ ] `TENDERLY_REQUIRED=true` for execute paths
- [ ] Rate limits + API keys rotated
- [ ] x402 recipient = production treasury

### Go-live

- [ ] Sepolia soak test ≥ 24h with keeper auto top-ups observed
- [ ] Mainnet deploy dry-run checklist signed off
- [ ] Incident runbook linked from `docs/KEEPER_VERIFICATION.md` (Sepolia) + this doc

---

## Suggested mainnet deploy command

```bash
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export PAYMASTER_ADDRESS=0xYourPimlicoOrTreasuryPaymaster
export KEEPER_ADDRESS=0xYourKeeperHotWallet
export TOPUP_THRESHOLD=100000000   # $100
export TOPUP_AMOUNT=50000000       # $50
export DEPLOYER_PRIVATE_KEY=0x...  # cold/multisig deployer — local only

forge script script/DeployPaymasterAutoTopUp.s.sol:DeployPaymasterAutoTopUp \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify
```
