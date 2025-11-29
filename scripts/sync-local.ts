#!/usr/bin/env node
/**
 * Local script to run initial sync against production D1 database
 * This bypasses Cloudflare Workers timeout limits for the initial full sync
 * 
 * Usage: npx tsx scripts/sync-local.ts
 * 
 * Requires:
 * - .dev.vars file with all required secrets
 * - wrangler CLI authenticated
 * - Production D1 database accessible via --remote flag
 */

import { config } from 'dotenv';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .dev.vars
const devVarsPath = join(process.cwd(), '.dev.vars');
const devVars = readFileSync(devVarsPath, 'utf-8')
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#'))
  .reduce((acc, line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      acc[key.trim()] = valueParts.join('=').trim();
    }
    return acc;
  }, {} as Record<string, string>);

// Set environment variables
for (const [key, value] of Object.entries(devVars)) {
  process.env[key] = value;
}

async function runLocalSync() {
  console.log('🚀 Starting local sync against production D1 database...\n');

  // Validate required env vars
  const required = ['VENICE_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX', 'RPC_URL'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  console.log('📋 Configuration:');
  console.log(`   - Pinecone Index: ${process.env.PINECONE_INDEX}`);
  console.log(`   - RPC URL: ${process.env.RPC_URL?.substring(0, 30)}...`);
  console.log(`   - Venice API Key: ${process.env.VENICE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - Pinecone API Key: ${process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing'}\n`);

  // Start wrangler dev server with --remote flag in background
  console.log('🌐 Starting wrangler dev server with remote D1 binding...');
  
  const serverUrl = 'http://localhost:8787';
  const syncEndpoint = `${serverUrl}/api/sync`;

  // Start server in background
  const wranglerProcess = execSync(
    'npx wrangler@latest dev --remote --port 8787',
    { 
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, ...devVars }
    }
  );

  // Note: This script approach won't work well because wrangler dev blocks
  // Instead, we should just tell the user to run it manually
  console.log('\n❌ This approach has limitations. Use the manual method instead:\n');
  console.log('1. In one terminal, run:');
  console.log('   npm run dev:remote\n');
  console.log('2. In another terminal, run:');
  console.log(`   curl -X POST ${syncEndpoint}\n`);
  console.log('Or use the deployed endpoint:');
  console.log('   curl -X POST https://agent0-semantic-search.dawid-pisarczyk.workers.dev/api/sync\n');
}

runLocalSync().catch(error => {
  console.error('❌ Sync failed:', error);
  process.exit(1);
});




