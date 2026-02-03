#!/bin/bash

echo "🔨 Building Next.js frontend..."
cd clients/web-dashboard
npm run build

echo "📦 Copying static files to backend..."
cd ../..
rm -rf services/git-app-backend/static
cp -r clients/web-dashboard/out services/git-app-backend/static

echo "✅ Deployment build complete!"
echo "📁 Static files ready in: services/git-app-backend/static"
echo "🚀 Push to GitHub to deploy on Render"
