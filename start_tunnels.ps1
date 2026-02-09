# Start-Tunnels.ps1
# Automates Cloudflare Tunnel setup for Blackbox Tester

Write-Host "🚀 Starting Blackbox Tester Tunnels..." -ForegroundColor Cyan

# 1. Kill existing tunnels
Write-Host "Stopping old tunnels..."
Stop-Process -Name cloudflared -ErrorAction SilentlyContinue

# 2. Start Bot Tunnel (Port 8001)
Write-Host "Starting Bot Tunnel (Port 8001)..."
Start-Job -ScriptBlock {
    & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8001 > tunnel_bot.txt 2>&1
} | Out-Null

# 3. Start Auth Tunnel (Port 8000)
Write-Host "Starting Auth Tunnel (Port 8000)..."
Start-Job -ScriptBlock {
    & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000 > tunnel_auth.txt 2>&1
} | Out-Null

Write-Host "Waiting 10s for tunnels to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 4. Extract URLs
$botContent = Get-Content -Path "tunnel_bot.txt" -Raw -ErrorAction SilentlyContinue
$authContent = Get-Content -Path "tunnel_auth.txt" -Raw -ErrorAction SilentlyContinue

$botUrl = $null
$authUrl = $null

if ($botContent -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
    $botUrl = $matches[0]
}
if ($authContent -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
    $authUrl = $matches[0]
}

if (-not $botUrl -or -not $authUrl) {
    Write-Error "Failed to get URLs. Check tunnel_bot.txt or tunnel_auth.txt."
    exit 1
}

Write-Host "`n✅ Tunnels Active!" -ForegroundColor Green
Write-Host "---------------------------------------------------"
Write-Host "Bot URL (Webhooks): $botUrl" -ForegroundColor Cyan
Write-Host "Auth URL (Login):   $authUrl" -ForegroundColor Cyan
Write-Host "---------------------------------------------------`n"

# 5. Update Frontend (Login Page)
$loginPagePath = "clients/web-dashboard/app/auth/login/page.tsx"
Write-Host "Updating Frontend Login Page ($loginPagePath)..."
$loginContent = Get-Content $loginPagePath -Raw
# Replace any existing trycloudflare URL or localhost with new Auth URL
$loginContent = $loginContent -replace 'https://[a-zA-Z0-9-]+\.trycloudflare\.com/auth/login', "$authUrl/auth/login"
$loginContent = $loginContent -replace 'http://localhost:8000/auth/login', "$authUrl/auth/login"
Set-Content -Path $loginPagePath -Value $loginContent

# 6. Update Backend (.env) - PUBLIC_API_URL
$backendEnvPath = "services/platform-backend/.env"
Write-Host "Updating Backend .env ($backendEnvPath)..."
$envContent = Get-Content $backendEnvPath -Raw
if ($envContent -match "PUBLIC_API_URL=") {
    $envContent = $envContent -replace "PUBLIC_API_URL=.*", "PUBLIC_API_URL=`"$authUrl`""
} else {
    $envContent += "`nPUBLIC_API_URL=`"$authUrl`""
}
Set-Content -Path $backendEnvPath -Value $envContent

Write-Host "✅ Codebase updated with new URLs." -ForegroundColor Green

# 7. Instructions
Write-Host "`n⚠️  MANUAL ACTION REQUIRED ⚠️" -ForegroundColor Yellow
Write-Host "Go to GitHub App Settings -> General -> Webhook URL:"
Write-Host "  $botUrl/api/v1/github_webhooks" -ForegroundColor White
Write-Host "`nGo to GitHub App Settings -> Identifying users -> Callback URL:"
Write-Host "  $authUrl/auth/callback/github" -ForegroundColor White

Write-Host "`n(Restart your backend services if they don't auto-reload)"
