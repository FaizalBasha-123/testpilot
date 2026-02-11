#!/bin/bash
# ==========================================================
# TestPilot - One-Command Local Startup (macOS / Linux)
# ==========================================================
# Usage: chmod +x start.sh && ./start.sh
# ==========================================================

set -e

echo ""
echo "========================================"
echo "  TestPilot - Local Development Setup"
echo "========================================"
echo ""

# ---- Step 1: Check Docker ----
echo "[1/5] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "  ERROR: Docker is not running."
    echo "  Please start Docker Desktop and try again."
    exit 1
fi
echo "  Docker is running."

# ---- Step 2: Setup .env ----
echo "[2/5] Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created .env from .env.example"
    
    echo ""
    echo "  You need a Groq API key (free at https://console.groq.com)"
    read -p "  Enter your GROQ_API_KEY (or press Enter to skip): " GROQ_KEY
    if [ -n "$GROQ_KEY" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^GROQ_API_KEY=.*$/GROQ_API_KEY=$GROQ_KEY/" .env
        else
            sed -i "s/^GROQ_API_KEY=.*$/GROQ_API_KEY=$GROQ_KEY/" .env
        fi
        echo "  Groq API key saved."
    else
        echo "  Skipped. You can set GROQ_API_KEY in .env later."
    fi
else
    echo "  .env already exists."
fi

# ---- Step 3: Start Docker services ----
echo "[3/5] Starting Docker services..."
docker compose up -d
echo "  All containers started."

# ---- Step 4: Wait for SonarQube ----
echo "[4/5] Waiting for SonarQube to initialize (this takes 1-2 min)..."
MAX_WAIT=180
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(curl -sf http://localhost:9000/api/system/status 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || true)
    if [ "$STATUS" = "UP" ]; then
        echo "  SonarQube is UP!"
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo "  Waiting... (${ELAPSED}s)"
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "  WARNING: SonarQube took too long. Check: http://localhost:9000"
fi

# ---- Step 5: Auto-generate SonarQube token ----
echo "[5/5] Configuring SonarQube token..."
if grep -q "SONARQUBE_TOKEN=." .env 2>/dev/null; then
    echo "  SonarQube token already configured."
else
    TOKEN=$(curl -sf -X POST "http://localhost:9000/api/user_tokens/generate" \
        -d "name=testpilot-auto" \
        -u admin:admin 2>/dev/null | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)
    
    if [ -n "$TOKEN" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^SONARQUBE_TOKEN=.*$/SONARQUBE_TOKEN=$TOKEN/" .env
        else
            sed -i "s/^SONARQUBE_TOKEN=.*$/SONARQUBE_TOKEN=$TOKEN/" .env
        fi
        echo "  SonarQube token auto-generated and saved to .env"
    else
        echo "  Could not auto-generate token (SonarQube may need password change)."
        echo "  Visit http://localhost:9000, login admin/admin, generate a token manually."
    fi
fi

# ---- Done! ----
echo ""
echo "========================================"
echo "  TestPilot is READY!"
echo "========================================"
echo ""
echo "  Gateway:     http://localhost:3001"
echo "  AI Core:     http://localhost:3000"
echo "  SonarQube:   http://localhost:9000"
echo "  Sonar API:   http://localhost:8001"
echo ""
echo "  VS Code Setup:"
echo "    1. Install TestPilot extension"
echo "    2. Set backend URL: http://localhost:3001"
echo "    3. Review a commit!"
echo ""
echo "  To stop:  docker compose down"
echo "  To logs:  docker compose logs -f ai-core"
echo ""
