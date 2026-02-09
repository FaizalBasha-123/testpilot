# TestPilot Deployment Guide (Beginner-Friendly)

## Quick Overview

| Component | Host | Purpose |
|-----------|------|---------|
| **Landing Page** | Vercel | Marketing, `/`, `/learnings` |
| **Gateway + Dashboard** | Render | Auth, Dashboard, APIs |
| **AI Core** | Render | AI Review Engine |
| **Sonar Scanner** | Render | Static Analysis |
| **SonarQube** | Self-hosted | Rule Engine (needs 2GB RAM) |

---

## Step 1: Initialize Git Repository

```bash
cd d:\blackboxtester-mvp
git init
git add .
git commit -m "Initial commit"
```

### Create GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Name: `testpilot` (or your choice)
3. Keep it **Private**
4. **Don't** add README (you have one)
5. Click "Create repository"

```bash
git remote add origin https://github.com/YOUR_USERNAME/testpilot.git
git branch -M main
git push -u origin main
```

---

## Step 2: Set Up SonarQube (Self-Hosted)

> **Why self-hosted?** SonarQube needs 2GB+ RAM. Render/Vercel don't support this.

### Option A: Hetzner (€4/month) - Recommended
1. Sign up at [hetzner.com](https://www.hetzner.com/cloud)
2. Create CX22 server (4GB RAM, €4.51/mo)
3. Choose Ubuntu 22.04
4. SSH in and run:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Run SonarQube
docker run -d --name sonarqube \
  -p 9000:9000 \
  -v sonarqube_data:/opt/sonarqube/data \
  -v sonarqube_logs:/opt/sonarqube/logs \
  sonarqube:lts-community

# Wait 2 minutes for startup, then access:
# http://YOUR_SERVER_IP:9000
# Login: admin / admin (change immediately!)
```

### Option B: OCI Free Tier ($0/month)
See [OCI Free Tier Guide](https://oracle.com/cloud/free).

### After SonarQube is Running:
1. Login at `http://YOUR_SERVER_IP:9000`
2. Change admin password
3. Go to **Administration → Security → Users → admin → Tokens**
4. Create token named `testpilot`
5. **Save this token** - you'll need it!

---

## Step 3: Deploy to Render

### 3.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### 3.2 Deploy Gateway (Go)

1. Click **New → Web Service**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| Name | `testpilot-gateway` |
| Root Directory | `services/gateway` |
| Runtime | Go |
| Build Command | `go build -o gateway .` |
| Start Command | `./gateway` |
| Plan | Starter ($7/mo) or Free |

4. Add Environment Variables:

| Key | Value |
|-----|-------|
| `GITHUB_CLIENT_ID` | (from your GitHub OAuth App) |
| `GITHUB_CLIENT_SECRET` | (from your GitHub OAuth App) |
| `GITHUB_OAUTH_REDIRECT` | `https://testpilot-gateway.onrender.com/auth/callback` |
| `JWT_SECRET` | (generate: `openssl rand -hex 32`) |
| `FRONTEND_URL` | `https://your-app.vercel.app` (set after Vercel deploy) |
| `BACKEND_URL` | `https://testpilot-gateway.onrender.com` |
| `DATABASE_URL` | (Render will provide if you add PostgreSQL) |

5. Click **Create Web Service**

### 3.3 Deploy AI Core (Python/Docker)

1. Click **New → Web Service**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `testpilot-ai-core` |
| Root Directory | `services/ai-core` |
| Runtime | Docker |
| Dockerfile Path | `docker/Dockerfile` |
| Plan | Standard ($25/mo) - needs memory for AI |

3. Add Environment Variables:

| Key | Value |
|-----|-------|
| `SONAR_SERVICE_URL` | `https://testpilot-sonar-scanner.onrender.com` |
| `SONARQUBE__URL` | `http://YOUR_SONARQUBE_IP:9000` |
| `SONARQUBE__TOKEN` | (from Step 2) |
| `OPENROUTER__KEY` | (from openrouter.ai) |
| `GROQ_API_KEY` | (from groq.com) |

### 3.4 Deploy Sonar Scanner (Rust/Docker)

1. Click **New → Web Service**
2. Configure:

| Setting | Value |
|---------|-------|
| Name | `testpilot-sonar-scanner` |
| Root Directory | `services/sonar-scanner` |
| Runtime | Docker |
| Dockerfile Path | `Dockerfile` |
| Plan | Starter ($7/mo) |

3. Add Environment Variables:

| Key | Value |
|-----|-------|
| `SONARQUBE_URL` | `http://YOUR_SONARQUBE_IP:9000` |
| `SONARQUBE_TOKEN` | (from Step 2) |

---

## Step 4: Deploy Landing Page to Vercel

### 4.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

### 4.2 Import Project
1. Click **Add New → Project**
2. Import your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `clients/web-dashboard` |
| Build Command | `npm run build` |
| Output Directory | `.next` |

4. Add Environment Variables:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://testpilot-gateway.onrender.com` |

5. Click **Deploy**

### 4.3 Update Gateway's FRONTEND_URL
After Vercel gives you a URL (e.g., `testpilot.vercel.app`):
1. Go to Render → testpilot-gateway → Environment
2. Update `FRONTEND_URL` to your Vercel URL
3. Click Save (will auto-redeploy)

---

## Step 5: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:

| Field | Value |
|-------|-------|
| Application name | TestPilot |
| Homepage URL | `https://your-app.vercel.app` |
| Authorization callback URL | `https://testpilot-gateway.onrender.com/auth/callback` |

4. Click **Register application**
5. Copy **Client ID** and generate **Client Secret**
6. Add these to Gateway environment variables

---

## Step 6: Test the Flow

1. Visit your Vercel URL (landing page)
2. Click "Sign in with GitHub"
3. Should redirect to Gateway → GitHub OAuth → Dashboard
4. Check `/dashboard` shows your repos

---

## Environment Variables Summary

### Gateway (Render)
```env
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_OAUTH_REDIRECT=https://testpilot-gateway.onrender.com/auth/callback
JWT_SECRET=xxx
FRONTEND_URL=https://your-app.vercel.app
BACKEND_URL=https://testpilot-gateway.onrender.com
DATABASE_URL=postgres://...
```

### AI Core (Render)
```env
SONAR_SERVICE_URL=https://testpilot-sonar-scanner.onrender.com
SONARQUBE__URL=http://your-sonarqube-ip:9000
SONARQUBE__TOKEN=xxx
OPENROUTER__KEY=xxx
GROQ_API_KEY=xxx
```

### Sonar Scanner (Render)
```env
SONARQUBE_URL=http://your-sonarqube-ip:9000
SONARQUBE_TOKEN=xxx
```

### Landing (Vercel)
```env
NEXT_PUBLIC_BACKEND_URL=https://testpilot-gateway.onrender.com
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| OAuth callback fails | Check `GITHUB_OAUTH_REDIRECT` matches exactly |
| Dashboard shows 404 | Ensure Gateway has `/static` folder with Next.js export |
| SonarQube won't start | Wait 2-3 minutes, check logs with `docker logs sonarqube` |
| AI review fails | Check `OPENROUTER__KEY` or `GROQ_API_KEY` is set |

---

## Cost Summary

| Service | Cost |
|---------|------|
| Render Gateway | $0-7/mo |
| Render AI Core | $25/mo |
| Render Sonar Scanner | $7/mo |
| Hetzner SonarQube | €4/mo |
| Vercel Landing | $0 |
| **Total** | **~$40/mo** |
