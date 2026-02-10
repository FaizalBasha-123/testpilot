# Build AI-Core with verification
# PowerShell Script

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Building AI-Core (API-Only, No PyTorch)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Step 1: Verify requirements.txt is clean
Write-Host "`n[1/4] Verifying requirements.txt..." -ForegroundColor Yellow
$requirements = Get-Content "services\ai-core\requirements.txt" -Raw
$bannedPackages = @('torch', 'pytorch', 'tensorflow', 'sentence-transformers', 'lancedb')
$foundBanned = @()

foreach ($pkg in $bannedPackages) {
    if ($requirements -match $pkg) {
        $foundBanned += $pkg
    }
}

if ($foundBanned.Count -gt 0) {
    Write-Host "❌ ERROR: Found banned packages: $($foundBanned -join ', ')" -ForegroundColor Red
    Write-Host "Edit services\ai-core\requirements.txt to remove them" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Clean: No ML packages in requirements.txt" -ForegroundColor Green
}

# Step 2: Verify Dockerfile is clean
Write-Host "`n[2/4] Verifying Dockerfile..." -ForegroundColor Yellow
$dockerfile = Get-Content "services\ai-core\docker\Dockerfile" -Raw
if ($dockerfile -match 'torch torchvision torchaudio') {
    Write-Host "❌ ERROR: Dockerfile still installs PyTorch" -ForegroundColor Red
    Write-Host "Remove the torch installation lines from docker/Dockerfile" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Clean: Dockerfile does not install PyTorch" -ForegroundColor Green
}

# Step 3: Build the image
Write-Host "`n[3/4] Building Docker image..." -ForegroundColor Yellow
Write-Host "This should be fast (no 3GB PyTorch download)..." -ForegroundColor Gray

$buildStart = Get-Date
docker-compose build --no-cache ai-core 2>&1 | Tee-Object -Variable buildOutput

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ BUILD FAILED" -ForegroundColor Red
    exit 1
}

$buildEnd = Get-Date
$buildTime = ($buildEnd - $buildStart).TotalSeconds

Write-Host "`n✅ Build completed in $([math]::Round($buildTime, 1)) seconds" -ForegroundColor Green

# Step 4: Verify the built image
Write-Host "`n[4/4] Verifying built image..." -ForegroundColor Yellow

# Check if build output contained PyTorch
if ($buildOutput -match 'torch|tensor|pytorch') {
    Write-Host "⚠️  WARNING: Build output contains 'torch' or 'tensor'" -ForegroundColor Yellow
    Write-Host "   This might indicate transitive dependencies" -ForegroundColor Yellow
}

# Check image size
$imageSize = docker images testpilot-ai-core --format "{{.Size}}" | Select-Object -First 1
Write-Host "Image size: $imageSize" -ForegroundColor Cyan

if ($imageSize -match '(\d+)GB' -and [int]$Matches[1] -gt 1) {
    Write-Host "⚠️  WARNING: Image is larger than 1GB" -ForegroundColor Yellow
    Write-Host "   Expected: ~500MB for API-only build" -ForegroundColor Yellow
    Write-Host "   Actual: $imageSize" -ForegroundColor Yellow
} else {
    Write-Host "✅ Image size looks good (< 1GB)" -ForegroundColor Green
}

# Final summary
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "BUILD SUCCESSFUL" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start services:  docker-compose up -d ai-core" -ForegroundColor White
Write-Host "2. Check logs:      docker-compose logs -f ai-core" -ForegroundColor White
Write-Host "3. Verify no torch: docker exec testpilot-ai-core pip list | grep torch" -ForegroundColor White
Write-Host "   (Should return nothing)" -ForegroundColor Gray
Write-Host ""
