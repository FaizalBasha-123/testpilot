# lock_existing_tunnels.ps1
# Reads current tunnel.md, verifies endpoints, and generates hardcoded tunnel mode files.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$renderGateway = "https://testpilot-64v5.onrender.com"
$tunnelMdPath = Join-Path (Get-Location) "tunnel.md"

if (-not (Test-Path $tunnelMdPath)) {
    throw "tunnel.md not found. Run .\start_tunnels.ps1 first."
}

$rawLines = Get-Content $tunnelMdPath | ForEach-Object { $_.Trim() }
$kv = @{}
foreach ($line in $rawLines) {
    if ($line -match '^[A-Z0-9_]+=' ) {
        $parts = $line.Split('=', 2)
        if ($parts.Length -eq 2) {
            $kv[$parts[0]] = $parts[1]
        }
    }
}

$required = @("AI_CORE_URL", "AI_REVIEW_WEBHOOK_URL", "SONAR_SERVICE_URL", "SONARQUBE_URL")
foreach ($key in $required) {
    if (-not $kv.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($kv[$key])) {
        throw "Missing required tunnel key in tunnel.md: $key"
    }
}

function Test-Url {
    param(
        [Parameter(Mandatory = $true)][string]$Url
    )
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
        return @{ Ok = $true; Status = $resp.StatusCode }
    } catch {
        if ($_.Exception.Response) {
            return @{ Ok = $false; Status = [int]$_.Exception.Response.StatusCode.value__ }
        }
        return @{ Ok = $false; Status = -1 }
    }
}

$checks = @(
    @{ Name = "AI Core"; Url = "$($kv['AI_CORE_URL'])/health" },
    @{ Name = "AI Webhook Route"; Url = "$($kv['AI_REVIEW_WEBHOOK_URL'])" },
    @{ Name = "Sonar Scanner"; Url = "$($kv['SONAR_SERVICE_URL'])/health" },
    @{ Name = "SonarQube"; Url = "$($kv['SONARQUBE_URL'])/api/system/status" }
)

$results = @()
foreach ($c in $checks) {
    $r = Test-Url -Url $c.Url
    $results += @{ Name = $c.Name; Url = $c.Url; Ok = $r.Ok; Status = $r.Status }
}

$lockLines = @(
    "# Locked tunnel mode (generated from current running tunnels)",
    "# Generated at $(Get-Date -Format s)",
    "GATEWAY_URL=$renderGateway",
    "TESTPILOT_BACKEND_URL=$renderGateway",
    "AI_CORE_URL=$($kv['AI_CORE_URL'])",
    "AI_REVIEW_WEBHOOK_URL=$($kv['AI_REVIEW_WEBHOOK_URL'])",
    "SONAR_SERVICE_URL=$($kv['SONAR_SERVICE_URL'])",
    "SONARQUBE__URL=$($kv['SONARQUBE_URL'])",
    "SONARQUBE_URL=$($kv['SONARQUBE_URL'])",
    "ENABLE_MOCK_REVIEW=false",
    "LOCAL_GATEWAY_DISABLED=true"
)

$lockPath = Join-Path (Get-Location) "tunnel.lock.env"
Set-Content -Path $lockPath -Value ($lockLines -join "`r`n")

# Pin workspace extension backend URL to Render gateway.
$vscodeDir = Join-Path (Get-Location) ".vscode"
if (-not (Test-Path $vscodeDir)) {
    New-Item -ItemType Directory -Path $vscodeDir | Out-Null
}
$settingsPath = Join-Path $vscodeDir "settings.json"
$settings = @{}
if (Test-Path $settingsPath) {
    try {
        $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json -AsHashtable
    } catch {
        $settings = @{}
    }
}
$settings["testpilot.backendUrl"] = $renderGateway
$settingsJson = $settings | ConvertTo-Json -Depth 8
Set-Content -Path $settingsPath -Value $settingsJson

$outPath = Join-Path (Get-Location) "TUNNEL_MODE_STATUS.md"
$doc = @()
$doc += "# Tunnel Mode Status"
$doc += "# Generated at $(Get-Date -Format s)"
$doc += ""
$doc += "## Hardcoded Targets"
$doc += "GATEWAY_URL=$renderGateway"
$doc += "AI_CORE_URL=$($kv['AI_CORE_URL'])"
$doc += "AI_REVIEW_WEBHOOK_URL=$($kv['AI_REVIEW_WEBHOOK_URL'])"
$doc += "SONAR_SERVICE_URL=$($kv['SONAR_SERVICE_URL'])"
$doc += "SONARQUBE_URL=$($kv['SONARQUBE_URL'])"
$doc += ""
$doc += "## Reachability"
foreach ($row in $results) {
    $doc += "- $($row['Name']): status=$($row['Status']) url=$($row['Url'])"
}
$doc += ""
$doc += "## Files Updated"
$doc += "- tunnel.lock.env"
$doc += "- .vscode/settings.json (testpilot.backendUrl pinned to Render gateway)"

Set-Content -Path $outPath -Value ($doc -join "`r`n")

Write-Host "Tunnel mode locked." -ForegroundColor Green
Write-Host "Generated: $lockPath"
Write-Host "Generated: $outPath"
