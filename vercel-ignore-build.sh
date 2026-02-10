#!/bin/bash

# Determine the latest commit
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  # No previous commit, build everything
  echo "🛑 No previous commit found. Building..."
  exit 1
fi

echo "🔍 Checking for changes in clients/web-dashboard..."

# Check if there are changes in the web-dashboard directory
# git diff --quiet returns 1 if there are changes, 0 if no changes
git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- clients/web-dashboard

if [ $? -eq 1 ]; then
  echo "✅ Changes detected in clients/web-dashboard. Proceeding with build."
  exit 1  # Exit 1 tells Vercel to PROCEED with build
else
  echo "🛑 No changes in clients/web-dashboard. Skipping build."
  exit 0  # Exit 0 tells Vercel to CANCEL build
fi
