# AgentExec Keeper — Base Sepolia live verification (PowerShell)
# Usage:
#   1. Fund owner with Base Sepolia ETH + Circle USDC
#   2. Start keeper in another terminal: cd gateway; go run ./cmd/keeper
#   3. cd contracts; .\..\scripts\keeper-verify.ps1
#
# Does NOT print or log your private key.

$ErrorActionPreference = "Stop"
$VAULT = "0x5D5a97110a7504dc04e2442B669B0FB408aE74B6"
$USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
$RPC = "https://sepolia.base.org"
$KEEPER = "0x3095fFB7E1654273EF0c3AB60595D8CEa6ad9400"

$env:PATH = "$env:USERPROFILE\.foundry\bin;$env:PATH"

Write-Host "== AgentExec Keeper Verification ==" -ForegroundColor Cyan
Write-Host "Vault: $VAULT"
Write-Host "RPC:   $RPC"
Write-Host ""

if (-not $env:OWNER_PRIVATE_KEY -or $env:OWNER_PRIVATE_KEY.Length -lt 66) {
  $k = Read-Host "Paste owner private key (not shared with anyone)"
  $k = $k.Trim().Replace("0x", "")
  if ($k.Length -ne 64) { throw "Expected 64 hex chars, got $($k.Length)" }
  $env:OWNER_PRIVATE_KEY = "0x$k"
}

Write-Host "[0] setKeeper($KEEPER)"
cast send $VAULT "setKeeper(address)" $KEEPER --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY

$bal = cast call $USDC "balanceOf(address)(uint256)" $KEEPER --rpc-url $RPC
Write-Host "[1] Owner USDC balance (raw): $bal"
if ($bal -eq "0" -or $bal -eq "0x0") {
  Write-Host "Get Base Sepolia USDC from https://faucet.circle.com/ then re-run." -ForegroundColor Yellow
  exit 1
}

$deposit = "100000000" # 100 USDC
Write-Host "[1b] approve + deposit $deposit"
cast send $USDC "approve(address,uint256)" $VAULT $deposit --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY
cast send $VAULT "deposit(uint256)" $deposit --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY
Write-Host "vaultBalance=$(cast call $VAULT 'vaultBalance()(uint256)' --rpc-url $RPC)"

Write-Host "[2] setThreshold(1000 USDC) to force needsTopUp"
cast send $VAULT "setThreshold(uint256)" 1000000000 --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY
Write-Host "needsTopUp=$(cast call $VAULT 'needsTopUp()(bool)' --rpc-url $RPC)"
Write-Host "paymasterBalance=$(cast call $VAULT 'paymasterBalance()(uint256)' --rpc-url $RPC)"
Write-Host "threshold=$(cast call $VAULT 'threshold()(uint256)' --rpc-url $RPC)"

Write-Host ""
Write-Host "[3] Watch the keeper terminal for executeTopUp within ~30s" -ForegroundColor Green
Write-Host "    Then press Enter here to reset threshold to 100 USDC..."
[void][System.Console]::ReadLine()

Write-Host "[4] setThreshold(100 USDC)"
cast send $VAULT "setThreshold(uint256)" 100000000 --rpc-url $RPC --private-key $env:OWNER_PRIVATE_KEY
Write-Host "totalToppedUp=$(cast call $VAULT 'totalToppedUp()(uint256)' --rpc-url $RPC)"
Write-Host "topUpCount=$(cast call $VAULT 'topUpCount()(uint256)' --rpc-url $RPC)"
Write-Host "Done." -ForegroundColor Cyan
