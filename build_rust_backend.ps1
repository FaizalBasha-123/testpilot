# Build and test the Rust sonar-backend service
# PowerShell version

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Building Rust Sonar Backend" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Navigate to sonar-backend directory
Push-Location services\sonar-backend

try {
    # Build the Docker image
    Write-Host "`nBuilding Docker image..." -ForegroundColor Yellow
    docker build -t sonar-backend:test .

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Build successful!" -ForegroundColor Green
        
        Write-Host "`nImage details:" -ForegroundColor Cyan
        docker images sonar-backend:test
        
        Write-Host "`n==========================================" -ForegroundColor Cyan
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "1. Start services:     docker-compose up -d"
        Write-Host "2. Run verification:   python verify_rust_backend.py"
        Write-Host "3. Check logs:         docker-compose logs -f sonar-service"
        Write-Host ""
    } else {
        Write-Host "`n❌ Build failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
