#!/usr/bin/env bash
# Build and test the Rust sonar-backend service

set -e

echo "=========================================="
echo "Building Rust Sonar Backend"
echo "=========================================="

cd "$(dirname "$0")/services/sonar-backend"

# Build the Docker image
echo "Building Docker image..."
docker build -t sonar-backend:test .

echo ""
echo "✅ Build successful!"
echo ""
echo "Image details:"
docker images sonar-backend:test

echo ""
echo "=========================================="
echo "Next steps:"
echo "=========================================="
echo "1. Start services:     docker-compose up -d ai-core sonar-scanner sonarqube redis postgres qdrant"
echo "2. Run verification:   python verify_rust_backend.py"
echo "3. Check logs:         docker-compose logs -f sonar-service"
echo ""
