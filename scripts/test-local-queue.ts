#!/usr/bin/env node
/**
 * Local test script for queue-based indexing
 * 
 * This script:
 * 1. Clears local D1 database
 * 2. Starts wrangler dev server
 * 3. Triggers a sync via /api/sync endpoint
 * 4. Monitors queue processing
 * 
 * Usage:
 *   npx tsx scripts/test-local-queue.ts
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

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

async function clearLocalD1(): Promise<void> {
  console.log('🧹 Clearing local D1 database...');
  
  return new Promise((resolve, reject) => {
    const wrangler = spawn('npx', ['wrangler@latest', 'd1', 'execute', 'semantic-sync-state', '--local', '--command', 'DELETE FROM sync_state; DELETE FROM sync_logs; DELETE FROM indexing_config;'], {
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
        console.log('✅ Local D1 database cleared\n');
        resolve();
      } else {
        console.warn('⚠️  Could not clear local D1 (may not exist yet)\n');
        resolve(); // Continue anyway
      }
    });

    wrangler.on('error', (error) => {
      console.warn('⚠️  Error clearing local D1:', error.message);
      resolve(); // Continue anyway
    });
  });
}

async function applyMigrations(): Promise<void> {
  console.log('📋 Applying migrations to local D1...');
  
  return new Promise((resolve) => {
    const wrangler = spawn('npx', ['wrangler@latest', 'd1', 'migrations', 'apply', 'semantic-sync-state', '--local'], {
      stdio: 'pipe',
      shell: true,
    });

    let output = '';
    wrangler.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
      process.stdout.write(data);
    });

    wrangler.stderr?.on('data', (data: Buffer) => {
      output += data.toString();
      process.stderr.write(data);
    });

    wrangler.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Migrations applied\n');
      } else {
        console.warn('⚠️  Migration may have failed, but continuing...\n');
      }
      resolve();
    });

    wrangler.on('error', () => {
      console.warn('⚠️  Could not apply migrations, but continuing...\n');
      resolve();
    });
  });
}

async function waitForServer(port: number = 8787, maxWait: number = 30000): Promise<boolean> {
  console.log(`⏳ Waiting for server to be ready on port ${port}...`);
  
  const startTime = Date.now();
  const url = `http://localhost:${port}/api/v1/health`;
  
  while (Date.now() - startTime < maxWait) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('✅ Server is ready!\n');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.error('❌ Server did not become ready in time');
  return false;
}

async function triggerSync(port: number = 8787): Promise<void> {
  console.log('🚀 Triggering sync via /api/sync endpoint...\n');
  
  const url = `http://localhost:${port}/api/sync`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Sync triggered successfully!');
      console.log('📊 Response:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Sync failed:', result);
    }
  } catch (error) {
    console.error('❌ Error triggering sync:', error);
    throw error;
  }
}

async function checkSyncState(port: number = 8787): Promise<void> {
  console.log('\n📊 Checking sync state...');
  
  // We can't directly query D1 from here, but we can check the sync logs via an endpoint
  // For now, just log that we should check the wrangler logs
  console.log('💡 Check the wrangler dev server logs above to see:');
  console.log('   - Queue messages being sent');
  console.log('   - Queue consumer processing messages');
  console.log('   - Sync state updates');
}

async function main() {
  console.log('🧪 Local Queue-Based Indexing Test\n');
  console.log('=' .repeat(50) + '\n');
  
  const devVars = loadDevVars();
  
  // Step 1: Clear local D1
  await clearLocalD1();
  
  // Step 2: Apply migrations
  await applyMigrations();
  
  // Step 3: Start wrangler dev server
  console.log('🌐 Starting wrangler dev server...');
  console.log('   (This will run in the foreground - press Ctrl+C to stop)\n');
  
  const wranglerProcess = spawn('npx', ['wrangler@latest', 'dev', '--port', '8787'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...devVars },
    cwd: process.cwd(),
  });
  
  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 4: Wait for server to be ready
  const serverReady = await waitForServer(8787, 30000);
  if (!serverReady) {
    console.error('❌ Server did not start properly');
    process.exit(1);
  }
  
  // Step 5: Trigger sync
  await triggerSync(8787);
  
  // Step 6: Wait a bit for queue processing
  console.log('\n⏳ Waiting 10 seconds for queue processing...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Step 7: Check results
  await checkSyncState(8787);
  
  console.log('\n✅ Test complete!');
  console.log('💡 Keep the wrangler dev server running to see queue processing in real-time');
  console.log('   Press Ctrl+C to stop the server\n');
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

