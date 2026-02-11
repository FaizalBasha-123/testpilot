# TestPilot Hybrid Deployment Architecture
**Render Gateway + Local Services via Cloudflare Tunnels**

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     RENDER CLOUD (Gateway)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Gateway Service (Go)                                      │  │
│  │  https://testpilot-64v5.onrender.com                      │  │
│  │                                                            │  │
│  │  - Receives VS Code requests                              │  │
│  │  - Proxies to AI Core via tunnel                          │  │
│  │  - Handles authentication                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Cloudflare Tunnels (HTTPS)
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    LOCAL MACHINE (Heavy Compute)                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  AI Core (Python/FastAPI) - Port 3000                      │ │
│  │  Tunnel: https://results-earrings-powder-powerseller...    │ │
│  │  • Orchestrates analysis                                   │ │
│  │  • Calls Groq API for LLM                                  │ │
│  │  • Manages code graph & context                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Sonar Scanner (Rust) - Port 8001                          │ │
│  │  Tunnel: https://genuine-validity-supervisor-characterized...│
│  │  • Runs sonar-scanner CLI                                  │ │
│  │  • Sends results to SonarQube                              │ │
│  │  • Returns vulnerabilities                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SonarQube (Java) - Port 9000                              │ │
│  │  Tunnel: https://gloves-which-round-taxation...            │ │
│  │  • Static analysis engine                                  │ │
│  │  • Security vulnerability detection                        │ │
│  │  • Quality gates                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Infrastructure (Postgres, Redis, Qdrant)                  │ │
│  │  • No tunnels needed (backend only)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## ⚙️ Why This Architecture?

### Render Hosts Gateway
✅ **FREE tier** for public API  
✅ Always-on public endpoint  
✅ SSL/TLS handled automatically  
✅ No need for local port forwarding  

### Local Hosts Heavy Services
✅ **FREE** - No cloud compute costs  
✅ SonarQube needs 2GB+ RAM (expensive on cloud)  
✅ Sonar Scanner needs 4GB+ RAM for large projects  
✅ Full control over analysis environment  

### Cloudflare Tunnels Bridge Them
✅ **FREE** - No bandwidth limits  
✅ Secure HTTPS tunnels  
✅ No firewall/router config needed  
✅ Auto-reconnects on network changes  

---

## 🚀 Setup Guide

### Step 1: Start Local Services
```bash
# Start Docker services (all except gateway)
docker-compose up -d ai-core sonar-scanner sonarqube redis postgres qdrant

# Verify they're running
docker ps
```

Expected output:
- `testpilot-ai-core` → Port 3000
- `testpilot-sonar-scanner` → Port 8001
- `testpilot-sonarqube` → Port 9000
- `testpilot-postgres` → Port 5432
- `testpilot-redis` → Port 6379
- `testpilot-qdrant` → Port 6333

### Step 2: Create Cloudflare Tunnels
```bash
# Windows
.\start_tunnels.ps1

# Linux/Mac
./setup-tunnels.sh
```

This creates 3 tunnels and writes URLs to `tunnel.md`:
- AI Core tunnel
- Sonar Scanner tunnel
- SonarQube tunnel

### Step 3: Verify Tunnel Connectivity
```bash
python test_tunnels.py
```

Expected: All 3 tunnels show `✓ HTTP 200 ✓`

If tunnels fail:
1. Check Docker services: `docker ps`
2. Check tunnel processes: `Get-Process cloudflared` (Windows) or `ps aux | grep cloudflared` (Linux)
3. Restart tunnels: `.\start_tunnels.ps1` or `./setup-tunnels.sh`

### Step 4: Update Render Environment Variables

#### Option A: Render Dashboard (Recommended)
1. Go to https://dashboard.render.com
2. Select your gateway service (`testpilot-64v5`)
3. Go to **Environment** tab
4. Add/Update these variables:

```env
AI_CORE_URL=<from tunnel.md>
SONAR_SERVICE_URL=<from tunnel.md>
SONARQUBE_URL=<from tunnel.md>
```

5. Click **Save Changes** → Render will redeploy automatically

#### Option B: Copy from test script
```bash
python test_tunnels.py --update
```
Copy the output and paste into Render Dashboard.

### Step 5: Deploy Code Changes to Render

Since we fixed the `analyze_unified` endpoint, deploy to Render:

```bash
# Push to GitHub (Render watches your repo)
git add services/ai-core/
git commit -m "fix: add comprehensive error handling to analyze_unified endpoint"
git push origin main
```

Render will auto-deploy in ~2-3 minutes.

---

## 🔍 Testing the Full Flow

### 1. Test Local AI Core
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","build":"unknown"}
```

### 2. Test Tunneled AI Core
```bash
curl https://<your-ai-core-tunnel>.trycloudflare.com/health
# Expected: {"status":"ok","build":"unknown"}
```

### 3. Test Render Gateway → Tunneled AI Core
```bash
curl https://testpilot-64v5.onrender.com/api/v1/ide/analyze_unified \
  -X POST \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.zip"
  
# Expected: {"job_id":"xxx","status":"pending","analysis_type":"unified"}
```

### 4. Test from VS Code Extension
1. Open TestPilot extension
2. Click "Scan Repository"
3. Check Output panel for logs
4. Verify results appear in UI

---

## 🐛 Troubleshooting

### "Premature close" or HTML error pages
**Cause:** Render hasn't deployed latest code or tunnel URLs are wrong

**Fix:**
1. Check Render Dashboard → Logs for latest deploy status
2. Verify tunnel URLs in Render env match `tunnel.md`
3. Run `python test_tunnels.py` to verify tunnels are up

### "Context sync failed: Invalid JSON"
**Cause:** Backend returning HTML error page instead of JSON

**Fix:**
1. Check Render logs: https://dashboard.render.com → Your Service → Logs
2. Look for Python exceptions or connection errors
3. Verify `SONAR_SERVICE_URL` env var is set to tunnel URL

### 0 Vulnerabilities Found (but code has issues)
**Cause:** Sonar Scanner couldn't reach SonarQube or analysis failed

**Fix:**
1. Check local SonarQube: http://localhost:9000 (should load web UI)
2. Check scanner logs: `docker logs testpilot-sonar-scanner`
3. Verify `SONARQUBE_URL` tunnel in Render env
4. Check ai-core logs: `docker logs testpilot-ai-core | grep -i sonar`

### Tunnels keep disconnecting
**Cause:** Network instability or process killed

**Fix:**
1. Use background mode: `.\start_tunnels.ps1` already does this
2. Check processes: `Get-Process cloudflared`
3. Add to Windows Task Scheduler (autostart on boot)
4. Or use a more stable tunnel service (ngrok paid plan, Tailscale)

---

## 📊 Monitoring

### Check Service Health
```bash
# Local services
curl http://localhost:3000/health  # AI Core
curl http://localhost:8001/health  # Sonar Scanner
curl http://localhost:9000/api/system/status  # SonarQube

# Tunneled services
python test_tunnels.py
```

### Check Render Gateway
```bash
# Render gateway should be up (view in dashboard)
curl https://testpilot-64v5.onrender.com/health
```

### View Logs
```bash
# Local Docker logs
docker logs -f testpilot-ai-core
docker logs -f testpilot-sonar-scanner

# Render logs
# Go to https://dashboard.render.com → Your Service → Logs
```

---

## 💰 Cost Breakdown

| Component | Hosting | Cost |
|-----------|---------|------|
| Gateway | Render Free | $0 |
| AI Core | Local Docker | $0 |
| Sonar Scanner | Local Docker | $0 |
| SonarQube | Local Docker | $0 |
| Cloudflare Tunnels | Cloudflare | $0 |
| LLM API | Groq Free Tier | $0 (limited) |
| Postgres | Neon Free | $0 |
| Redis | Upstash Free | $0 |
| Vector DB | Local Qdrant | $0 |
| **TOTAL** | | **$0/month** |

---

## 🔄 Maintenance

### Restart Tunnels (if they die)
```bash
.\start_tunnels.ps1
python test_tunnels.py --update
# Update Render env vars with new URLs
```

### Restart Docker Services
```bash
docker-compose restart ai-core sonar-scanner sonarqube
```

### Update Code
```bash
# Local changes take effect immediately (hot reload for ai-core)
# For gateway changes, push to GitHub → Render auto-deploys
```

---

## 📝 Quick Reference

| Service | Local Port | Tunnel URL | Render Env Var |
|---------|-----------|------------|----------------|
| AI Core | 3000 | From tunnel.md | `AI_CORE_URL` |
| Sonar Scanner | 8001 | From tunnel.md | `SONAR_SERVICE_URL` |
| SonarQube | 9000 | From tunnel.md | `SONARQUBE_URL` |
| Gateway | N/A | testpilot-64v5.onrender.com | N/A |

**Commands:**
- Start services: `docker-compose up -d ai-core sonar-scanner sonarqube redis postgres qdrant`
- Start tunnels: `.\start_tunnels.ps1`
- Test tunnels: `python test_tunnels.py`
- View logs: `docker logs -f testpilot-ai-core`

---

## 🎯 Next Steps

1. ✅ **Run `python test_tunnels.py`** to verify connectivity
2. ✅ **Update Render env vars** with tunnel URLs from `tunnel.md`
3. ✅ **Push code changes** to trigger Render redeploy
4. ✅ **Test VS Code extension** with real repository scan
5. ✅ **Monitor logs** for any errors during first scan

---

**Need Help?**
- Check logs: `docker logs testpilot-ai-core`
- Re-run tests: `python test_tunnels.py`
- Restart tunnels: `.\start_tunnels.ps1`
- Restart services: `docker-compose restart ai-core`
