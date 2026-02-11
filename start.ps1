# ==========================================================
# TestPilot - One-Command Local Startup (Windows PowerShell)
# ==========================================================
# Usage: .\start.ps1
# ==========================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TestPilot - Local Development Setup"   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---- Step 1: Check Docker ----
Write-Host "[1/5] Checking Docker..." -ForegroundColor Yellow
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
    Write-Host "  Docker is running." -ForegroundColor Green
}
catch {
    Write-Host "  ERROR: Docker Desktop is not running." -ForegroundColor Red
    Write-Host "  Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# ---- Step 2: Setup .env ----
Write-Host "[2/5] Setting up environment..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  Created .env from .env.example" -ForegroundColor Green
    
    # Prompt for Groq API key
    Write-Host ""
    Write-Host "  You need a Groq API key (free at https://console.groq.com)" -ForegroundColor Yellow
    $groqKey = Read-Host "  Enter your GROQ_API_KEY (or press Enter to skip)"
    if ($groqKey) {
        (Get-Content .env) -replace '^GROQ_API_KEY=.*$', "GROQ_API_KEY=$groqKey" | Set-Content .env
        Write-Host "  Groq API key saved." -ForegroundColor Green
    }
    else {
        Write-Host "  Skipped. You can set GROQ_API_KEY in .env later." -ForegroundColor DarkYellow
    }
}
else {
    Write-Host "  .env already exists." -ForegroundColor Green
}

# ---- Step 3: Start Docker services ----
Write-Host "[3/5] Starting Docker services..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: docker compose up failed." -ForegroundColor Red
    exit 1
}
Write-Host "  All containers started." -ForegroundColor Green

# ---- Step 4: Wait for SonarQube ----
Write-Host "[4/5] Waiting for SonarQube to initialize (this takes 1-2 min)..." -ForegroundColor Yellow
$maxWait = 180
$elapsed = 0
while ($elapsed -lt $maxWait) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:9000/api/system/status" -UseBasicParsing -TimeoutSec 3 2>$null
        $status = ($resp.Content | ConvertFrom-Json).status
        if ($status -eq "UP") {
            Write-Host "  SonarQube is UP!" -ForegroundColor Green
            break
        }
    }
    catch { }
    Start-Sleep -Seconds 5
    $elapsed += 5
    Write-Host "  Waiting... ($elapsed s)" -ForegroundColor DarkGray
}

if ($elapsed -ge $maxWait) {
    Write-Host "  WARNING: SonarQube took too long. It may still be starting." -ForegroundColor DarkYellow
    Write-Host "  Check: http://localhost:9000" -ForegroundColor DarkYellow
}

# ---- Step 5: Auto-generate SonarQube token ----
Write-Host "[5/5] Configuring SonarQube token..." -ForegroundColor Yellow
$envContent = Get-Content .env -Raw
if ($envContent -match "SONARQUBE_TOKEN=.+") {
    Write-Host "  SonarQube token already configured." -ForegroundColor Green
}
else {
    try {
        $tokenResp = Invoke-WebRequest -Uri "http://localhost:9000/api/user_tokens/generate" `
            -Method POST `
            -Body "name=testpilot-auto" `
            -Headers @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin")) } `
            -UseBasicParsing -TimeoutSec 10

        $token = ($tokenResp.Content | ConvertFrom-Json).token
        if ($token) {
            (Get-Content .env) -replace '^SONARQUBE_TOKEN=.*$', "SONARQUBE_TOKEN=$token" | Set-Content .env
            Write-Host "  SonarQube token auto-generated and saved to .env" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  Could not auto-generate token (SonarQube may need password change)." -ForegroundColor DarkYellow
        Write-Host "  Visit http://localhost:9000, login admin/admin, generate a token manually." -ForegroundColor DarkYellow
    }
}

# ---- Done! ----
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  TestPilot is READY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Gateway:     http://localhost:3001"    -ForegroundColor White
Write-Host "  AI Core:     http://localhost:3000"    -ForegroundColor White
Write-Host "  SonarQube:   http://localhost:9000"    -ForegroundColor White
Write-Host "  Sonar API:   http://localhost:8001"    -ForegroundColor White
Write-Host ""
Write-Host "  VS Code Setup:" -ForegroundColor Cyan
Write-Host "    1. Install TestPilot extension"
Write-Host "    2. Set backend URL: http://localhost:3001"
Write-Host "    3. Review a commit!"
Write-Host ""
Write-Host "  To stop:  docker compose down" -ForegroundColor DarkGray
Write-Host "  To logs:  docker compose logs -f ai-core" -ForegroundColor DarkGray
Write-Host ""
