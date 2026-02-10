# TestPilot - Hybrid Cloud Tunnel Setup (Cloudflare)

This script sets up Cloudflare Tunnels to expose your local Docker services to the internet,
allowing the Render-hosted Gateway to communicate with your local SonarQube and AI Core.

## Prerequisites
1. Installed `cloudflared` CLI.
2. Login: `cloudflared tunnel login`

## Configuration
# 1. Create a tunnel
# cloudflared tunnel create testpilot-local

# 2. Route traffic (Example DNS)
# cloudflared tunnel route dns testpilot-local ai.testpilot.com
# cloudflared tunnel route dns testpilot-local sonar.testpilot.com

## Running the Tunnel
# You would typically run this in a terminal:
# cloudflared tunnel run --url http://localhost:3000 testpilot-local

# OR use a config.yml for multiple services:
# tunnel: <Tunnel-UUID>
# credentials-file: /root/.cloudflared/<Tunnel-UUID>.json
# ingress:
#   - hostname: ai.testpilot.com
#     service: http://localhost:3000
#   - hostname: sonar.testpilot.com
#     service: http://localhost:9000
#   - service: http_status:404

echo "Remember to set AI_CORE_URL and SONAR_SERVICE_URL in your Render Gateway environment!"
