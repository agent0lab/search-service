#!/usr/bin/env node
/**
 * Initial sync script - Populates D1 sync state and Pinecone vector store
 * 
 * This script performs a full initial sync of the ERC8004 registry:
 * 1. Connects to remote production D1 database
 * 2. Clears any existing sync state (fresh start)
 * 3. Runs full semantic sync for all configured chains
 * 4. Populates both D1 (sync state) and Pinecone (vectors)
 * 
 * Usage:
 *   1. Ensure .dev.vars has all required secrets
 *   2. Run: npx tsx scripts/init-sync.ts
 * 
 * Note: This requires wrangler CLI to be authenticated and have access to the remote D1 database
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// Load .dev.vars
function loadDevVars(): Record<string, string> {
  const devVarsPath = join(process.cwd(), '.dev.vars');
  try {
    const content = readFileSync(devVarsPath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          acc[key.trim()] = valueParts.join('=').trim();
        }
        return acc;
      }, {} as Record<string, string>);
  } catch (error) {
    throw new Error(`Failed to load .dev.vars: ${error}`);
  }
}

async function clearSyncState(): Promise<void> {
  console.log('🧹 Clearing existing sync state from D1...');
  
  return new Promise((resolve) => {
    const wrangler = spawn('npx', ['wrangler@latest', 'd1', 'execute', 'semantic-sync-state', '--remote', '--command', 'DELETE FROM sync_state'], {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    wrangler.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    wrangler.stderr?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    wrangler.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Sync state cleared\n');
      } else {
        // Ignore errors if table doesn't exist or is empty
        console.log('ℹ️  Sync state clear completed (may have been empty)\n');
      }
      resolve();
    });

    wrangler.on('error', () => {
      console.warn('⚠️  Could not clear sync state (may not exist yet)\n');
      resolve(); // Continue anyway
    });
  });
}

async function runInitialSync(): Promise<void> {
  console.log('🚀 Starting initial semantic sync...\n');

  const devVars = loadDevVars();

  // Validate required env vars
  const required = ['VENICE_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX', 'RPC_URL'];
  for (const key of required) {
    if (!devVars[key]) {
      throw new Error(`Missing required environment variable in .dev.vars: ${key}`);
    }
  }

  console.log('📋 Configuration:');
  console.log(`   - Pinecone Index: ${devVars.PINECONE_INDEX}`);
  console.log(`   - RPC URL: ${devVars.RPC_URL?.substring(0, 40)}...`);
  console.log(`   - Venice API Key: ${devVars.VENICE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - Pinecone API Key: ${devVars.PINECONE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  if (devVars.PINECONE_NAMESPACE) {
    console.log(`   - Pinecone Namespace: ${devVars.PINECONE_NAMESPACE}`);
  }
  console.log('');

  // Step 1: Clear sync state (optional - comment out to continue from existing state)
  // Uncomment the line below if you want to start fresh:
  // await clearSyncState();
  
  // For initial sync, we want to start fresh
  await clearSyncState();

  // Step 2: Start wrangler dev server with remote D1
  console.log('🌐 Starting wrangler dev server with remote D1 binding...');
  console.log('   (This will run in the background)\n');

  const serverUrl = 'http://localhost:8787';
  const syncEndpoint = `${serverUrl}/api/sync`;

  // Start wrangler dev in background
  const wranglerProcess = spawn('npx', ['wrangler@latest', 'dev', '--remote', '--port', '8787'], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, ...devVars },
    cwd: process.cwd(),
  });

  // Wait for server to be ready
  const maxWaitTime = 60000; // 60 seconds
  const startTime = Date.now();
  let serverReady = false;

  wranglerProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString();
    process.stdout.write(output);
  });

  wranglerProcess.stderr?.on('data', (data: Buffer) => {
    const output = data.toString();
    // Filter out common warnings but show errors
    if (!output.includes('warn') && !output.includes('deprecated')) {
      process.stderr.write(output);
    }
  });

  // Poll for server readiness
  console.log('   Waiting for server to be ready...');
  while (!serverReady && Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to check if server is responding
    try {
      const response = await fetch(`${serverUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        serverReady = true;
        break;
      }
    } catch {
      // Server not ready yet, continue waiting
      process.stdout.write('.');
    }
  }

  if (!serverReady) {
    wranglerProcess.kill();
    throw new Error('Timeout waiting for wrangler dev server to start. Make sure wrangler is authenticated.');
  }
  
  console.log(''); // New line after dots

  console.log('\n✅ Server is ready!\n');

  // Step 3: Trigger sync via HTTP endpoint
  console.log('🔄 Triggering initial sync...');
  console.log(`   Endpoint: ${syncEndpoint}\n`);

  try {
    const response = await fetch(syncEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    console.log('\n✅ Initial sync completed successfully!\n');
    
    if (result.lastLog) {
      console.log('📊 Results:');
      console.log(`   - Agents indexed: ${result.lastLog.agents_indexed ?? 0}`);
      console.log(`   - Agents deleted: ${result.lastLog.agents_deleted ?? 0}`);
      console.log(`   - Batches processed: ${result.lastLog.batches_processed ?? 0}`);
      console.log(`   - Status: ${result.lastLog.status}`);
      if (result.lastLog.duration_ms) {
        console.log(`   - Duration: ${result.lastLog.duration_ms}ms`);
      }
      if (result.lastLog.error_message) {
        console.log(`   - Error: ${result.lastLog.error_message}`);
      }
    }
    
    if (result.syncState && result.syncState.length > 0) {
      console.log('\n📝 Sync state:');
      for (const state of result.syncState) {
        console.log(`   - Chain ${state.chain_id}: Last updated at ${state.last_updated_at}`);
      }
    }

    console.log('\n🎉 Initial sync complete! You can now enable the cron job.\n');

  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    throw error;
  } finally {
    // Clean up: kill wrangler process
    console.log('\n🛑 Shutting down dev server...');
    wranglerProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run the script
runInitialSync().catch(error => {
  console.error('\n❌ Initial sync script failed:', error);
  process.exit(1);
});

