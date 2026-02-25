#!/usr/bin/env node
/**
 * Direct local sync script - runs in Node.js (not Cloudflare Workers).
 * Uses local file state; does not require remote D1 credentials.
 */

import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SDK } from 'agent0-sdk';
import { SemanticSyncRunner, type SemanticSyncStateStoreV2 } from '../worker/src/utils/semantic-sync-runner.js';
import { resolveSemanticSearchProvidersFromEnv } from '../worker/src/utils/config.js';

function loadDevVars(): Record<string, string> {
  const devVarsPath = join(process.cwd(), '.dev.vars');
  const content = readFileSync(devVarsPath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        acc[key.trim()] = valueParts.join('=').trim();
      }
      return acc;
    }, {} as Record<string, string>);
}

interface LocalChainState {
  lastUpdatedAt: string;
  agentHashes: Record<string, string>;
}

interface LocalSyncState {
  chains: Record<string, LocalChainState>;
}

class FileSemanticSyncStateStoreV2 implements SemanticSyncStateStoreV2 {
  constructor(private readonly filepath: string) {
    const dir = join(filepath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private readState(): LocalSyncState {
    if (!existsSync(this.filepath)) {
      return { chains: {} };
    }
    try {
      const raw = readFileSync(this.filepath, 'utf-8');
      const parsed = JSON.parse(raw) as LocalSyncState;
      if (!parsed || typeof parsed !== 'object' || !parsed.chains) {
        return { chains: {} };
      }
      return parsed;
    } catch {
      return { chains: {} };
    }
  }

  private writeState(state: LocalSyncState): void {
    writeFileSync(this.filepath, JSON.stringify(state, null, 2), 'utf-8');
  }

  async getLastUpdatedAt(chainId: string): Promise<string> {
    const state = this.readState();
    return state.chains[chainId]?.lastUpdatedAt ?? '0';
  }

  async setLastUpdatedAt(chainId: string, lastUpdatedAt: string): Promise<void> {
    const state = this.readState();
    state.chains[chainId] = state.chains[chainId] ?? { lastUpdatedAt: '0', agentHashes: {} };
    state.chains[chainId].lastUpdatedAt = lastUpdatedAt;
    this.writeState(state);
  }

  async getAgentHashes(chainId: string, agentIds: string[]): Promise<Record<string, string>> {
    if (agentIds.length === 0) return {};
    const state = this.readState();
    const hashes = state.chains[chainId]?.agentHashes ?? {};
    const out: Record<string, string> = {};
    for (const id of agentIds) {
      if (hashes[id]) out[id] = hashes[id];
    }
    return out;
  }

  async upsertAgentHashes(chainId: string, hashes: Record<string, string>): Promise<void> {
    const state = this.readState();
    state.chains[chainId] = state.chains[chainId] ?? { lastUpdatedAt: '0', agentHashes: {} };
    state.chains[chainId].agentHashes = { ...state.chains[chainId].agentHashes, ...hashes };
    this.writeState(state);
  }

  async deleteAgentHashes(chainId: string, agentIds: string[]): Promise<void> {
    if (agentIds.length === 0) return;
    const state = this.readState();
    const chain = state.chains[chainId];
    if (!chain) return;
    for (const id of agentIds) {
      delete chain.agentHashes[id];
    }
    this.writeState(state);
  }

  async migrateLegacyAgentHashesBlobToTable(): Promise<{ migrated: boolean; count: number }> {
    return { migrated: false, count: 0 };
  }
}

function getChainsFromEnv(): number[] {
  const raw = process.env.SEMANTIC_SYNC_CHAINS?.trim();
  if (!raw) return [3448148188];
  const parsed = raw
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));
  return parsed.length > 0 ? parsed : [3448148188];
}

async function runDirectSync() {
  console.log('🚀 Starting direct local sync (Node.js, no timeout limits)...\n');

  const devVars = loadDevVars();
  for (const [k, v] of Object.entries(devVars)) {
    if (!process.env[k]) process.env[k] = v;
  }

  const providers = resolveSemanticSearchProvidersFromEnv(process.env);
  if (providers.vectorStore.initialize) {
    await providers.vectorStore.initialize();
  }

  const chains = getChainsFromEnv();
  console.log(`📡 Syncing chains: ${chains.join(', ')}\n`);

  const chainId = Number(process.env.CHAIN_ID || chains[0] || 3448148188);
  let sdk: SDK | undefined;
  try {
    sdk = new SDK({
      chainId: chainId as any,
      rpcUrl: process.env.RPC_URL || 'https://nile.trongrid.io/jsonrpc',
    });
  } catch (error) {
    console.warn(`⚠️ SDK init skipped for chain ${chainId}: ${String(error)}`);
  }

  const statePath = process.env.SEMANTIC_SYNC_STATE || '.cache/semantic-sync-state.json';
  const stateStore = new FileSemanticSyncStateStoreV2(statePath);
  const targets = chains.map((id) => ({
    chainId: id,
    subgraphUrl: process.env[`SEMANTIC_SYNC_SUBGRAPH_${id}`],
  }));

  const runner = new SemanticSyncRunner(
    {
      batchSize: 50,
      stateStore,
      embeddingProvider: providers.embedding,
      vectorStoreProvider: providers.vectorStore,
      logger: (event, extra) => console.log(`[semantic-sync] ${event}`, extra ?? {}),
      targets,
    },
    sdk
  );

  console.log('🔄 Starting sync...\n');
  const startTime = Date.now();
  await runner.run();
  const duration = Date.now() - startTime;
  console.log('\n✅ Sync completed successfully!');
  console.log(`   Duration: ${Math.round(duration / 1000)}s\n`);
}

runDirectSync().catch((error) => {
  console.error('\n❌ Direct sync script failed:', error);
  process.exit(1);
});

