#!/bin/bash
# Test script for indexing service setup

set -e

echo "🧪 Testing Indexing Service Setup"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler CLI not found. Please install it: npm install -g wrangler"
    exit 1
fi

echo "✅ wrangler CLI found"
echo ""

# Check migrations
echo "📋 Checking migrations..."
if [ -f "migrations/0001_initial.sql" ]; then
    echo "✅ Initial migration found"
else
    echo "❌ Initial migration not found"
    exit 1
fi

if [ -f "migrations/0002_add_sync_logs.sql" ]; then
    echo "✅ Sync logs migration found"
else
    echo "❌ Sync logs migration not found"
    exit 1
fi

echo ""
echo "📝 Migration files:"
ls -lh migrations/

echo ""
echo "✅ Setup check complete!"
echo ""
echo "Next steps:"
echo "1. Create D1 database: wrangler d1 create semantic-sync-state"
echo "2. Update database_id in wrangler.toml"
echo "3. Apply migrations: wrangler d1 migrations apply semantic-sync-state"
echo "4. Set secrets: wrangler secret put VENICE_API_KEY, etc."

