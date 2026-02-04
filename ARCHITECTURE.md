# TestPilot - Multi-Domain Architecture with Smart Routing

## Architecture Overview

TestPilot uses a **distributed architecture** with intelligent routing:

- **Frontend (Vercel)**: `https://testpilot-drab.vercel.app` - Landing, login, and main app
- **Backend (Render)**: `https://testpilot-64v5.onrender.com` - API, webhooks, and OAuth callbacks

Like modern SaaS applications, the frontend and backend are hosted separately for optimal performance and scalability, while maintaining seamless user experience through smart routing.

## User Flow

1. **Landing Page**: User visits `https://testpilot-drab.vercel.app` (Vercel frontend)
2. **Login**: Clicks "Sign in with GitHub" → redirects to `https://testpilot-64v5.onrender.com/auth/login`
3. **OAuth State Handling**: Backend `/auth/install` endpoint mints state cookie before GitHub App install
4. **GitHub OAuth**: Approves → GitHub redirects to `/auth/callback` (backend validates state)
5. **Workspace Setup**: Backend redirects to `/auth/workspace?token=JWT` (Vercel frontend receives token)
6. **Dashboard**: Frontend stores JWT in localStorage → navigates to dashboard with full functionality
7. **GitHub App**: User installs TestPilot app on selected repositories

## Smart Routing Strategy

### Frontend Routes (Vercel)
- `/` - Landing page
- `/login` - Login page  
- `/auth/loading` - OAuth loading state
- `/auth/workspace` - Receives JWT token from backend
- `/dashboard/*` - Main application (protected)

### Backend Routes (Render)
- `/auth/login` - Initiates GitHub OAuth flow
- `/auth/install` - Mints state cookie for GitHub App installation
- `/auth/callback` - GitHub OAuth callback (validates state)
- `/api/repos` - List user repositories (requires JWT)
- `/api/orgs` - List user organizations (requires JWT)
- `/webhooks/github` - Receives GitHub App events
- `/health` - Health check
- `/` - Redirects landing/login to Vercel frontend

## Technical Stack

### Frontend
- **Next.js 16.1.6** with static export (`output: 'export'`)
- **React + TypeScript** for type safety
- **Tailwind CSS** for styling
- **Built files**: `clients/web-dashboard/out/` → copied to → `services/git-app-backend/static/`

### Backend
- **Go HTTP Server** on port 8001
- **Serves static files** from `./static` directory
- **API routes**: `/api/*`, `/auth/*`, `/webhooks/*`
- **SPA handler**: Falls back to `index.html` for client-side routing
- **PostgreSQL** for user data and GitHub tokens

## Deployment Process

### Automated Build Script
```bash
./deploy.sh
```

This script:
1. Builds Next.js frontend (`npm run build` in `clients/web-dashboard`)
2. Copies static files to `services/git-app-backend/static/`
3. Ready for git commit and Render deployment

### Manual Steps
```bash
# Build frontend
cd clients/web-dashboard
npm run build

# Copy to backend
cd ../..
rm -rf services/git-app-backend/static
cp -r clients/web-dashboard/out services/git-app-backend/static

# Deploy
git add .
git commit -m "deploy: update frontend"
git push origin main
```

## File Structure

```
TestPilot-MVP/
├── clients/web-dashboard/          # Next.js source code
│   ├── app/
│   │   ├── dashboard/page.tsx     # Main dashboard
│   │   ├── repositories/page.tsx  # Repo management
│   │   ├── integrations/page.tsx  # Integrations
│   │   ├── reports/page.tsx       # Analytics
│   │   ├── learnings/page.tsx     # AI insights
│   │   ├── settings/page.tsx      # Configuration
│   │   ├── account/page.tsx       # User profile
│   │   ├── wizard/page.tsx        # Onboarding wizard
│   │   └── components/Sidebar.tsx # Navigation
│   ├── next.config.js             # Static export config
│   └── package.json
│
└── services/git-app-backend/       # Go backend
    ├── main.go                     # HTTP server + static file serving
    ├── auth.go                     # GitHub OAuth
    ├── repo_api.go                 # Repository API
    ├── org_api.go                  # Organization API
    ├── mock_agent.go               # PR review webhook
    └── static/                     # Built Next.js frontend (gitignored locally, committed for Render)
        ├── index.html
        ├── _next/
        ├── dashboard/
        ├── repositories/
        └── ...
```

## API Routes

All API calls use **relative URLs** since frontend and backend share the same domain:

```typescript
// Before (separate domains)
fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/repos`, {
  headers: { Authorization: `Bearer ${token}` }
})

// After (unified domain)
fetch('/api/repos', {
  headers: { Authorization: `Bearer ${token}` }
})
```

## Environment Variables

### Vercel (Frontend)
```env
NEXT_PUBLIC_BACKEND_URL=https://testpilot-64v5.onrender.com
NODE_ENV=production
```

### Render (Backend)
```env
GITHUB_CLIENT_ID=Iv23lifdp0Zkk7P72cfn
GITHUB_CLIENT_SECRET=e2c53eea72f69b8603f6384c3bc4ac4d30c76d3d
GITHUB_OAUTH_REDIRECT=https://testpilot-64v5.onrender.com/auth/callback
GITHUB_WEBHOOK_SECRET=FAIZAL_BASHA_S
GITHUB_APP_ID=2785953
GITHUB_APP_PRIVATE_KEY=SHA256:TwESPx1eQW0iHHVWR2+13gyQoH23qD3hBH/Lfg71VyI=
GITHUB_APP_INSTALL_URL=https://github.com/apps/testpilot-ai-agent/installations/new
JWT_SECRET=FAIZAL_BASHA_S
DATABASE_URL=postgresql://neondb_owner:npg_BAkQHzx9Ko2t@ep-spring-heart-a1ukd2yb-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
BACKEND_URL=https://testpilot-64v5.onrender.com
FRONTEND_URL=https://testpilot-drab.vercel.app
```

## Benefits of Distributed Architecture

✅ **Frontend Performance** - Vercel's global CDN for instant page loads  
✅ **Backend Reliability** - Dedicated Go service for API and webhooks  
✅ **Separate Scaling** - Scale frontend and backend independently  
✅ **Smart Routing** - Automatic redirects handle domain transitions  
✅ **OAuth Security** - State validation prevents CSRF attacks on App installation  
✅ **Seamless UX** - Users never see domain switches in normal flow  
✅ **Development Flexibility** - Develop frontend and backend independently  

## Development

### Local Development

**Terminal 1** - Backend:
```bash
cd services/git-app-backend
go run *.go
# Runs on http://localhost:8001
# BACKEND_URL=http://localhost:8001
# FRONTEND_URL=http://localhost:3000
```

**Terminal 2** - Frontend:
```bash
cd clients/web-dashboard
npm run dev
# Runs on http://localhost:3000
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8001 for API calls
```

### Production Build

```bash
# Frontend (Vercel)
cd clients/web-dashboard
npm run build
# Auto-deployed to https://testpilot-drab.vercel.app

# Backend (Render)
cd services/git-app-backend
# Auto-deployed when main branch is pushed
```

## Next Steps

1. ✅ Deploy frontend to Vercel
2. ✅ Deploy backend to Render with correct environment variables
3. ✅ Configure GitHub OAuth with `GITHUB_OAUTH_REDIRECT` pointing to backend
4. ✅ Install TestPilot GitHub App on test repositories
5. ⏳ Test full OAuth flow: Landing → Login → OAuth → Dashboard
6. ⏳ Create test PR to trigger mock_agent webhook

## Troubleshooting

**Q: Frontend shows 404 errors?**  
A: Ensure NEXT_PUBLIC_BACKEND_URL is correctly set to Render backend URL.

**Q: OAuth redirects fail?**  
A: Verify `GITHUB_OAUTH_REDIRECT` environment variable matches the actual backend URL.

**Q: "Invalid state" error on GitHub App install?**  
A: User must start from `/auth/install` endpoint to mint the state cookie before redirect.

**Q: Tokens not persisting?**  
A: Ensure browser allows localStorage access (not in private/incognito mode).

**Q: Mock agent not creating PRs?**  
A: Check that GITHUB_WEBHOOK_SECRET in backend matches GitHub App settings.

**Q: API calls return 401 Unauthorized?**  
A: Ensure JWT token is present in localStorage and has not expired.
