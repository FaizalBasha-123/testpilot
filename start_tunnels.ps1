# start_tunnels.ps1
# Starts Cloudflare quick tunnels for local services and writes tunnel.md with env vars.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Starting tunnels for ai-core, sonar-scanner, and sonarqube..."

function Resolve-CloudflaredPath {
    $candidates = @(
        "cloudflared",
        "C:\Program Files\Cloudflare\Cloudflared\cloudflared.exe",
        "C:\Program Files (x86)\cloudflared\cloudflared.exe"
    )

    foreach ($candidate in $candidates) {
        try {
            $cmd = Get-Command $candidate -ErrorAction Stop
            if ($cmd -and $cmd.Source) {
                return $cmd.Source
            }
        } catch {
            # try next
        }
    }

    throw "cloudflared executable not found. Install cloudflared or add it to PATH."
}

function Stop-OldTunnelProcesses {
    param(
        [Parameter(Mandatory = $true)][string]$PidFile
    )

    if (Test-Path $PidFile) {
        try {
            $oldPids = Get-Content -Path $PidFile | Where-Object { $_ -match '^\d+$' }
            foreach ($pidText in $oldPids) {
                $pid = [int]$pidText
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($proc -and $proc.ProcessName -like "cloudflared*") {
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                }
            }
        } catch {
            # ignore stale pid file errors
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }

    # Hard cleanup for orphaned quick tunnels started earlier in this workspace.
    Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Start-TunnelProcess {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$LocalUrl,
        [Parameter(Mandatory = $true)][string]$CloudflaredPath
    )

    $logFile = Join-Path (Get-Location) ("tunnel_{0}.log" -f $Name)
    $errFile = Join-Path (Get-Location) ("tunnel_{0}.err.log" -f $Name)
    if (Test-Path $logFile) {
        Remove-Item $logFile -Force
    }
    if (Test-Path $errFile) {
        Remove-Item $errFile -Force
    }

    New-Item -Path $logFile -ItemType File -Force | Out-Null
    New-Item -Path $errFile -ItemType File -Force | Out-Null

    $proc = Start-Process -FilePath $CloudflaredPath `
        -ArgumentList @("tunnel", "--url", $LocalUrl, "--no-autoupdate") `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError $errFile `
        -WindowStyle Hidden `
        -PassThru

    return @{
        LogPath = $logFile
        ErrPath = $errFile
        Process = $proc
    }
}

function Get-TunnelUrlFromLog {
    param(
        [Parameter(Mandatory = $true)][string]$LogPath,
        [Parameter(Mandatory = $true)][string]$ErrPath
    )

    if ((-not (Test-Path $LogPath)) -and (-not (Test-Path $ErrPath))) {
        return $null
    }

    $content = @(
        (Get-Content -Path $LogPath -Raw -ErrorAction SilentlyContinue),
        (Get-Content -Path $ErrPath -Raw -ErrorAction SilentlyContinue)
    ) -join "`n"
    if (-not $content) {
        return $null
    }

    $match = [regex]::Match($content, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    if ($match.Success) {
        return $match.Value.TrimEnd("/")
    }
    return $null
}

function Wait-ForRemoteEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                return $true
            }
        } catch {
            # retry
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

# Service-to-local-port mapping.
$serviceMap = @(
    @{ Name = "ai_core";       LocalUrl = "http://localhost:3000"; HealthPath = "/health" },
    @{ Name = "sonar_scanner"; LocalUrl = "http://localhost:8001"; HealthPath = "/health" },
    @{ Name = "sonarqube";     LocalUrl = "http://localhost:9000"; HealthPath = "/api/system/status" }
)

$cloudflared = Resolve-CloudflaredPath
Write-Host ("Using cloudflared: {0}" -f $cloudflared)

$pidFile = Join-Path (Get-Location) "tunnel_pids.txt"
Stop-OldTunnelProcesses -PidFile $pidFile

$procInfo = @{}
foreach ($svc in $serviceMap) {
    Write-Host ("Starting tunnel {0} -> {1}" -f $svc.Name, $svc.LocalUrl)
    $procInfo[$svc.Name] = Start-TunnelProcess -Name $svc.Name -LocalUrl $svc.LocalUrl -CloudflaredPath $cloudflared
}

# Wait for URLs to appear in logs.
$deadline = (Get-Date).AddSeconds(60)
$urls = @{}
while ((Get-Date) -lt $deadline) {
    foreach ($svc in $serviceMap) {
        if (-not $urls.ContainsKey($svc.Name)) {
            $url = Get-TunnelUrlFromLog -LogPath $procInfo[$svc.Name].LogPath -ErrPath $procInfo[$svc.Name].ErrPath
            if ($url) {
                $urls[$svc.Name] = $url
            }
        }
    }

    if ($urls.Count -eq $serviceMap.Count) {
        break
    }

    Start-Sleep -Milliseconds 700
}

if ($urls.Count -ne $serviceMap.Count) {
    Write-Host "Failed to fetch all tunnel URLs. Check log files:" -ForegroundColor Red
    foreach ($svc in $serviceMap) {
        Write-Host ("  {0}: {1}" -f $svc.Name, $procInfo[$svc.Name].LogPath)
    }
    exit 1
}

# Verify tunnel reachability and keep running even if one lags.
foreach ($svc in $serviceMap) {
    $probeUrl = $urls[$svc.Name] + $svc.HealthPath
    $ok = Wait-ForRemoteEndpoint -Url $probeUrl -TimeoutSeconds 30
    if (-not $ok) {
        Write-Host ("Warning: tunnel endpoint not yet reachable: {0}" -f $probeUrl) -ForegroundColor Yellow
    }
}

# Persist process ids for next cleanup.
$pids = @()
foreach ($svc in $serviceMap) {
    $p = $procInfo[$svc.Name].Process
    if ($p -and -not $p.HasExited) {
        $pids += [string]$p.Id
    }
}
Set-Content -Path $pidFile -Value ($pids -join "`r`n")

$aiCoreUrl = $urls["ai_core"]
$sonarScannerUrl = $urls["sonar_scanner"]
$sonarqubeUrl = $urls["sonarqube"]

$envLines = @(
    ("AI_CORE_URL={0}" -f $aiCoreUrl),
    ("AI_REVIEW_WEBHOOK_URL={0}/api/v1/github_webhooks" -f $aiCoreUrl),
    ("SONAR_SERVICE_URL={0}" -f $sonarScannerUrl),
    ("SONARQUBE__URL={0}" -f $sonarqubeUrl),
    ("SONARQUBE_URL={0}" -f $sonarqubeUrl),
    "ENABLE_MOCK_REVIEW=false"
)

$tunnelMdPath = Join-Path (Get-Location) "tunnel.md"
$doc = @()
$doc += "# Tunnel Environment Variables"
$doc += "# Generated by start_tunnels.ps1 at $(Get-Date -Format s)"
$doc += ""
$doc += '```env'
$doc += $envLines
$doc += '```'
$doc += ""
$doc += "# Raw key=value"
$doc += $envLines

# Replace previous file content every run.
Set-Content -Path $tunnelMdPath -Value ($doc -join "`r`n")

Write-Host ""
Write-Host "Tunnels are active and tunnel.md has been replaced with fresh values." -ForegroundColor Green
Write-Host ""
foreach ($line in $envLines) {
    Write-Host $line
}
Write-Host ""
Write-Host "Log files:"
foreach ($svc in $serviceMap) {
    Write-Host ("  {0}: {1}" -f $svc.Name, $procInfo[$svc.Name].LogPath)
}
