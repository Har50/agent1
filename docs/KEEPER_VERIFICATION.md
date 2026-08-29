# Paymaster Drain Simulation & Live Keeper Verification

**Network:** Base Sepolia (`84532`)  
**Vault:** [`0x5D5a97110a7504dc04e2442B669B0FB408aE74B6`](https://sepolia.basescan.org/address/0x5D5a97110a7504dc04e2442B669B0FB408aE74B6)  
**USDC (Circle):** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

> **Important:** Base Sepolia USDC is Circle’s token — there is **no public `mint()`**.  
> Get test USDC from the [Circle faucet](https://faucet.circle.com/) (select Base Sepolia).

Deploy defaults: `threshold = 100 USDC`, `topUpAmount = 50 USDC`,  
keeper at deploy = `0x1a7309…`. Your running keeper is `0x3095f…` (owner) — call `setKeeper` first.

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| Owner / deployer key | Controls vault (`0x3095fFB7E1654273EF0c3AB60595D8CEa6ad9400`) |
| Keeper process | `go run ./cmd/keeper` with correct `.env` |
| Sepolia ETH | On owner + keeper for gas |
| Sepolia USDC | On owner wallet for `deposit()` |

PowerShell: ensure Foundry is on PATH:

```powershell
$env:PATH = "$env:USERPROFILE\.foundry\bin;$env:PATH"
$VAULT = "0x5D5a97110a7504dc04e2442B669B0FB408aE74B6"
$USDC  = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
$RPC   = "https://sepolia.base.org"
```

Load owner key (same session — don’t paste into chat):

```powershell
$k = Read-Host "Owner/deployer private key"
$k = $k.Trim().Replace("0x","")
$env:OWNER_PRIVATE_KEY = "0x$k"
```

---

## Step 0 — Authorize this keeper (one-time)

```powershell
cast send $VAULT "setKeeper(address)" 0x3095fFB7E1654273EF0c3AB60595D8CEa6ad9400 `
  --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY
```

---

## Step 1 — Fund the vault

### 1a. Get USDC

1. Open https://faucet.circle.com/  
2. Network: **Base Sepolia**  
3. Send USDC to `0x3095fFB7E1654273EF0c3AB60595D8CEa6ad9400`  

Check:

```powershell
cast call $USDC "balanceOf(address)(uint256)" 0x3095fFB7E1654273EF0c3AB60595D8CEa6ad9400 --rpc-url $RPC
```

### 1b. Approve + deposit (e.g. 100 USDC = `100000000`)

```powershell
# Approve vault to pull USDC
cast send $USDC "approve(address,uint256)" $VAULT 100000000 `
  --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY

# Deposit into PaymasterAutoTopUp
cast send $VAULT "deposit(uint256)" 100000000 `
  --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY

cast call $VAULT "vaultBalance()(uint256)" --rpc-url $RPC
```

---

## Step 2 — Force `needsTopUp = true`

Raise threshold above current paymaster balance (e.g. **1000 USDC**):

```powershell
cast send $VAULT "setThreshold(uint256)" 1000000000 `
  --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY

cast call $VAULT "needsTopUp()(bool)" --rpc-url $RPC
cast call $VAULT "paymasterBalance()(uint256)" --rpc-url $RPC
cast call $VAULT "threshold()(uint256)" --rpc-url $RPC
```

Expect `needsTopUp() → true` if `vaultBalance >= topUpAmount` and `paymasterBalance < threshold`.

---

## Step 3 — Watch the keeper

Within ~30s the running daemon should log something like:

```text
[OK] vault=100000000 paymaster=... needsTopUp=true
[WARN] Paymaster below threshold — submitting executeTopUp()
[KEEPER] executeTopUp tx submitted: 0x...
```

Confirm on-chain:

```powershell
cast call $VAULT "vaultBalance()(uint256)" --rpc-url $RPC
cast call $VAULT "totalToppedUp()(uint256)" --rpc-url $RPC
cast call $VAULT "topUpCount()(uint256)" --rpc-url $RPC
```

BaseScan vault:  
https://sepolia.basescan.org/address/0x5D5a97110a7504dc04e2442B669B0FB408aE74B6

---

## Step 4 — Reset threshold

Restore a sane threshold (e.g. **100 USDC** = deploy default, or **10 USDC**):

```powershell
# 100 USDC (deploy default)
cast send $VAULT "setThreshold(uint256)" 100000000 `
  --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY

# Or 10 USDC:
# cast send $VAULT "setThreshold(uint256)" 10000000 --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY
```

---

## Helper script

See `scripts/keeper-verify.ps1` for a semi-automated PowerShell walkthrough.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Unauthorized` on `executeTopUp` | Run Step 0 `setKeeper` |
| `InsufficientVaultBalance` | Deposit more USDC (Step 1) |
| `needsTopUp=false` | Threshold still ≤ paymaster balance |
| Keeper still on `0x0000…` | Fix `PAYMASTER_TOPUP_CONTRACT` in `gateway/.env` |
