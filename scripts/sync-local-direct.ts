#!/usr/bin/env node
/**
 * Direct local sync script - Runs in Node.js (not Cloudflare Workers)
 * 
 * This script performs a full sync directly in Node.js, bypassing Cloudflare Workers
 * timeout limits. It uses a local file for state during sync, then syncs to D1 at the end.
 * 
 * Usage:
 *   1. Ensure .dev.vars has all required secrets
 *   2. Run: npx tsx scripts/sync-local-direct.ts
 * 
 * This approach:
 * - Runs in Node.js (no timeout limits)
 * - Uses local file for state during sync (fast)
 * - Syncs final state to remote D1 at the end
 * - Works exactly like the example script but updates D1
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { SDK } from 'agent0-ts/index.js';
import { SemanticSyncRunner, type SemanticSyncRunnerOptions, FileSemanticSyncStateStore } from 'agent0-ts/semantic-search/index.js';
import type { SemanticSyncState } from 'agent0-ts/semantic-search/index.js';

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

/**
 * Sync state from local file to remote D1 database
 */
async function syncStateToD1(state: SemanticSyncState): Promise<void> {
  console.log('\n💾 Syncing state to remote D1 database...');
  
  try {
    for (const [chainId, chainState] of Object.entries(state.chains)) {
      const agentHashesJson = chainState.agentHashes
        ? JSON.stringify(chainState.agentHashes).replace(/'/g, "''")
        : 'NULL';

      const sql = `INSERT INTO sync_state (chain_id, last_updated_at, agent_hashes) VALUES ('${chainId}', '${chainState.lastUpdatedAt}', ${agentHashesJson !== 'NULL' ? `'${agentHashesJson}'` : 'NULL'}) ON CONFLICT(chain_id) DO UPDATE SET last_updated_at = '${chainState.lastUpdatedAt}', agent_hashes = ${agentHashesJson !== 'NULL' ? `'${agentHashesJson}'` : 'NULL'}`;
      
      execSync(
        `npx wrangler@latest d1 execute semantic-sync-state --remote --command "${sql}"`,
        { stdio: 'pipe', encoding: 'utf-8' }
      );
      
      console.log(`   ✅ Synced state for chain ${chainId}`);
    }
    console.log('✅ State synced to D1 successfully\n');
  } catch (error: any) {
    console.error('⚠️  Failed to sync state to D1:', error.message);
    console.error('   State is still saved locally and can be synced manually');
    throw error;
  }
}

/**
 * Get chains from D1 config or use defaults
 */
async function getChainsFromD1(): Promise<number[]> {
  const defaultChains = [11155111, 84532]; // Sepolia, Base Sepolia
  
  try {
    const result = execSync(
      `npx wrangler@latest d1 execute semantic-sync-state --remote --command "SELECT value FROM indexing_config WHERE key = 'chains'"`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );
    
    const parsed = JSON.parse(result);
    if (parsed.results && parsed.results.length > 0 && parsed.results[0].value) {
      const chains = JSON.parse(parsed.results[0].value);
      if (Array.isArray(chains) && chains.length > 0) {
        return chains.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id));
      }
    }
  } catch (error) {
    console.warn('Could not read chains from D1 config, using defaults');
  }
  
  return defaultChains;
}

async function runDirectSync() {
  console.log('🚀 Starting direct local sync (Node.js, no timeout limits)...\n');

  const devVars = loadDevVars();

  // Validate required env vars
  const required = ['VENICE_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX', 'RPC_URL'];
  for (const key of required) {
    if (!devVars[key] && !process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    // Use env var if available, otherwise use devVars
    if (!process.env[key]) {
      process.env[key] = devVars[key];
    }
  }

  console.log('📋 Configuration:');
  console.log(`   - Pinecone Index: ${process.env.PINECONE_INDEX}`);
  console.log(`   - RPC URL: ${process.env.RPC_URL?.substring(0, 40)}...`);
  console.log(`   - Venice API Key: ${process.env.VENICE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - Pinecone API Key: ${process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  if (process.env.PINECONE_NAMESPACE) {
    console.log(`   - Pinecone Namespace: ${process.env.PINECONE_NAMESPACE}`);
  }
  console.log('');

  // Get chains from D1 or use defaults
  const chains = await getChainsFromD1();
  console.log(`📡 Syncing chains: ${chains.join(', ')}\n`);

  // Initialize SDK (same as example script)
  const chainId = Number(process.env.CHAIN_ID || chains[0]);
  const sdk = new SDK({
    chainId,
    rpcUrl: process.env.RPC_URL!,
    semanticSearch: {
      embedding: {
        provider: 'venice',
        apiKey: process.env.VENICE_API_KEY!,
        model: process.env.VENICE_MODEL || 'text-embedding-bge-m3',
      },
      vectorStore: {
        provider: 'pinecone',
        apiKey: process.env.PINECONE_API_KEY!,
        index: process.env.PINECONE_INDEX!,
        namespace: process.env.PINECONE_NAMESPACE,
      },
    },
  });

  // Use local file for state (fast, no D1 calls during sync)
  const statePath = process.env.SEMANTIC_SYNC_STATE || '.cache/semantic-sync-state.json';
  const store = new FileSemanticSyncStateStore({ filepath: statePath });

  // Build targets
  const chainTargets = (process.env.SEMANTIC_SYNC_CHAINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        throw new Error(`Invalid chain id in SEMANTIC_SYNC_CHAINS: ${value}`);
      }
      const override = process.env[`SEMANTIC_SYNC_SUBGRAPH_${parsed}`];
      return {
        chainId: parsed,
        subgraphUrl: override,
      };
    });

  const defaultTargets = chains.map((id) => ({ chainId: id }));
  const targets = chainTargets.length > 0 ? chainTargets : defaultTargets;

  // Create sync runner (same as example script)
  const runner = new SemanticSyncRunner(sdk, {
    batchSize: 50,
    stateStore: store,
    logger: (event, extra) => {
      console.log(`[semantic-sync] ${event}`, extra ?? {});
    },
    targets,
  });

  // Run the sync
  console.log('🔄 Starting sync...\n');
  const startTime = Date.now();
  
  try {
    await runner.run();
    const duration = Date.now() - startTime;
    
    console.log('\n✅ Sync completed successfully!');
    console.log(`   Duration: ${Math.round(duration / 1000)}s\n`);

    // Load final state and sync to D1
    const finalState = await store.load();
    if (finalState) {
      await syncStateToD1(finalState);
    } else {
      console.log('⚠️  No state to sync to D1\n');
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n❌ Sync failed:', error);
    console.log(`   Duration: ${Math.round(duration / 1000)}s\n`);
    
    // Try to save partial state to D1 anyway
    try {
      const partialState = await store.load();
      if (partialState) {
        console.log('💾 Attempting to save partial state to D1...');
        await syncStateToD1(partialState);
        console.log('✅ Partial state saved - next sync will continue from here\n');
      }
    } catch (stateError) {
      console.error('⚠️  Could not save partial state to D1:', stateError);
    }
    
    throw error;
  }
}

// Run the script
runDirectSync().catch(error => {
  console.error('\n❌ Direct sync script failed:', error);
  process.exit(1);
});
