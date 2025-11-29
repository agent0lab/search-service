#!/bin/bash
# Simple script to trigger sync on local dev server with remote D1
# 
# Usage:
#   1. In one terminal: npm run dev:remote
#   2. In another terminal: ./scripts/sync-local-simple.sh

echo "🔄 Triggering sync on local dev server..."
curl -X POST http://localhost:8787/api/sync

echo -e "\n✅ Done! Check the logs in your wrangler dev terminal."




