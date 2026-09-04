# Replace yourdomain.com placeholders before production build/deploy.
# Usage:
#   .\scripts\replace-production-domain.ps1 -SiteDomain agentexec.io -ApiDomain api.agentexec.io
param(
  [Parameter(Mandatory = $true)][string]$SiteDomain,
  [Parameter(Mandatory = $true)][string]$ApiDomain
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$SiteDomain = $SiteDomain -replace '^https?://', '' -replace '/$', ''
$ApiDomain = $ApiDomain -replace '^https?://', '' -replace '/$', ''

$Files = @(
  "website/public/AGENTS.md",
  "website/public/.well-known/mcp.json",
  "website/public/.well-known/agent-card.json",
  "smithery.yaml",
  "docs/AGENT_DISCOVERY.md",
  "docs/RENDER_AND_MONITORING.md",
  "docs/MAINNET_CHECKLIST.md",
  "docs/PRODUCTION_DEPLOYMENT.md",
  "docs/mcp-client.example.json",
  "docs/MASTER_PLAN.md"
)

Write-Host "Replacing placeholders:"
Write-Host "  yourdomain.com     -> $SiteDomain"
Write-Host "  api.yourdomain.com -> $ApiDomain"

$changed = 0
foreach ($rel in $Files) {
  $f = Join-Path $Root $rel
  if (-not (Test-Path $f)) { continue }
  $text = Get-Content -Raw -Path $f
  if ($text -notmatch 'yourdomain\.com') { continue }
  $new = $text.Replace("api.yourdomain.com", $ApiDomain).Replace("yourdomain.com", $SiteDomain)
  Set-Content -Path $f -Value $new -NoNewline
  Write-Host "  updated $rel"
  $changed++
}

Write-Host "Done. Files updated: $changed"
Write-Host "Next: review git diff, commit, deploy Render, then verify endpoints."
