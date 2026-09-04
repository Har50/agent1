# Live WebMCP intent smoke test (PowerShell)
# Usage:
#   $env:AGENT_API_KEY = "your-key"
#   .\scripts\test-intent.ps1
param(
  [string]$GatewayUrl = "https://api.agentexec.dev/api/v1/intent"
)

$ErrorActionPreference = "Continue"
$ApiKey = $env:AGENT_API_KEY
if ([string]::IsNullOrWhiteSpace($ApiKey)) { $ApiKey = $env:API_KEY }

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " AgentExec WebMCP Intent Execution Test" -ForegroundColor Cyan
Write-Host " Target Endpoint: $GatewayUrl" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$intent = @{
  toolName = "purchase_premium_data"
  targetContract = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  abiMethod = "fetchData()"
  args = @{ endpoint = "/analytics" }
} | ConvertTo-Json -Compress

function Invoke-Intent {
  param([hashtable]$Headers, [string]$Body)
  try {
    $params = @{
      Uri = $GatewayUrl
      Method = "POST"
      ContentType = "application/json"
      Body = $Body
      TimeoutSec = 20
      UseBasicParsing = $true
    }
    if ($Headers.Count -gt 0) { $params.Headers = $Headers }
    $resp = Invoke-WebRequest @params
    return @{ Code = [int]$resp.StatusCode; Body = $resp.Content }
  } catch {
    $r = $_.Exception.Response
    if (-not $r) { return @{ Code = 0; Body = $_.Exception.Message } }
    $code = [int]$r.StatusCode
    try {
      $reader = New-Object System.IO.StreamReader($r.GetResponseStream())
      $content = $reader.ReadToEnd()
      $reader.Close()
    } catch { $content = "" }
    return @{ Code = $code; Body = $content }
  }
}

Write-Host "[1/2] Testing x402 Handshake (expecting HTTP 402)..." -ForegroundColor Yellow
$h1 = @{}
if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
  $h1["X-API-Key"] = $ApiKey
} else {
  Write-Host "hint: set `$env:AGENT_API_KEY to pass API auth and assert 402" -ForegroundColor Yellow
}
$r1 = Invoke-Intent -Headers $h1 -Body $intent
Write-Host "HTTP Response Status: $($r1.Code)"
Write-Host $r1.Body
if ($r1.Code -eq 402) {
  Write-Host "Correctly received HTTP 402 Payment Required." -ForegroundColor Green
} elseif ($r1.Code -eq 401) {
  Write-Host "HTTP 401 — set AGENT_API_KEY to reach x402." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[2/2] Sending Intent with mock session / payment headers..." -ForegroundColor Yellow
$paymentPayload = '{"tool":"purchase_premium_data","amountUSD":0.1,"recipient":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","timestamp":0,"nonce":"0x01"}'
$mockSig = "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001b"
$h2 = @{
  "X-402-Payment-Signature" = $mockSig
  "X-402-Payment-Payload" = $paymentPayload
  "X-Session-Key-Address" = "0x1111111111111111111111111111111111111111"
}
if (-not [string]::IsNullOrWhiteSpace($ApiKey)) { $h2["X-API-Key"] = $ApiKey }

$r2 = Invoke-Intent -Headers $h2 -Body $intent
Write-Host "HTTP Response Status: $($r2.Code)"
Write-Host $r2.Body
if ($r2.Code -eq 401) {
  Write-Host "Gateway rejected invalid session signature (expected for mock sig)." -ForegroundColor Green
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Intent test execution sequence complete." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
