# TestPilot - Unified Domain Architecture

## Architecture Overview

TestPilot now serves both backend API and frontend UI from a **single domain** on Render:

```
https://testpilot-64v5.onrender.com
```

Just like CodeRabbit's `app.coderabbit.ai`, everything runs on one domain for a seamless experience.

## User Flow

1. **Login**: User visits `https://testpilot-64v5.onrender.com` → clicks "Sign in with GitHub"
2. **OAuth**: Redirects to GitHub OAuth → approves → back to `/auth/callback`
3. **Wizard**: First-time users see `/auth/workspace` → redirects to `/wizard` for onboarding
4. **Dashboard**: After wizard completion → redirects to `/dashboard` with sidebar navigation

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

## Environment Variables (Render)

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_OAUTH_REDIRECT=https://testpilot-64v5.onrender.com/auth/callback
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
GITHUB_APP_INSTALL_URL=https://github.com/apps/testpilot-ai-agent/installations/new
JWT_SECRET=your_jwt_secret
DATABASE_URL=postgresql://...
BACKEND_URL=https://testpilot-64v5.onrender.com
FRONTEND_URL=https://testpilot-64v5.onrender.com  # Same as BACKEND_URL
```

## Benefits of Unified Domain

✅ **No CORS issues** - Frontend and backend on same origin  
✅ **Simpler deployment** - One service instead of two  
✅ **Faster navigation** - No cross-origin requests  
✅ **Better UX** - Consistent domain like CodeRabbit  
✅ **Easier authentication** - Tokens stay on same domain  

## Development

### Local Development

**Terminal 1** - Backend:
```bash
cd services/git-app-backend
go run *.go
# Runs on http://localhost:8001
```

**Terminal 2** - Frontend (for development):
```bash
cd clients/web-dashboard
npm run dev
# Runs on http://localhost:3000
# Uses NEXT_PUBLIC_BACKEND_URL=http://localhost:8001 for API calls
```

**Production** - Unified:
```bash
# Build frontend
cd clients/web-dashboard
npm run build

# Copy to backend
cd ../..
cp -r clients/web-dashboard/out services/git-app-backend/static

# Run backend (serves both)
cd services/git-app-backend
go run *.go
# Visit http://localhost:8001 for everything
```

## Next Steps

1. ✅ Build frontend with `npm run build`
2. ✅ Copy static files to backend
3. ✅ Update auth redirect to use BACKEND_URL
4. ✅ Commit static files to git
5. ✅ Push to GitHub → Render auto-deploys
6. ⏳ Visit `https://testpilot-64v5.onrender.com` to test!

## Troubleshooting

**Q: Frontend shows 404 errors?**  
A: Make sure static files are in `services/git-app-backend/static/` and committed to git.

**Q: API calls fail?**  
A: Check that backend routes in `main.go` are registered before the SPA handler.

**Q: Login redirects to wrong URL?**  
A: Verify `GITHUB_OAUTH_REDIRECT` and `BACKEND_URL` match your Render domain.

**Q: Static files not updating?**  
A: Run `./deploy.sh` to rebuild and copy latest frontend changes.
