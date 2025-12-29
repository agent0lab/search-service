import { describe, it, expect, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { D1SemanticSyncStateStoreV2 } from '../worker/src/utils/d1-sync-state-store-v2.js';

type SyncStateRow = { last_updated_at: string; agent_hashes: string | null };

class MockD1Database implements D1Database {
  syncState = new Map<string, SyncStateRow>(); // chain_id -> row
  agentHashes = new Map<string, { hash: string; updated_at: string }>(); // `${chain}:${agent}` -> row

  prepare(query: string) {
    const self = this;
    return {
      bind: (...values: unknown[]) => ({
        first: async <T = unknown>(): Promise<T | null> => {
          // sync_state.last_updated_at
          if (query.includes('SELECT last_updated_at FROM sync_state WHERE chain_id = ?')) {
            const chainId = values[0] as string;
            const row = self.syncState.get(chainId);
            return row ? ({ last_updated_at: row.last_updated_at } as T) : null;
          }

          // sync_state.agent_hashes
          if (query.includes('SELECT agent_hashes FROM sync_state WHERE chain_id = ?')) {
            const chainId = values[0] as string;
            const row = self.syncState.get(chainId);
            return row ? ({ agent_hashes: row.agent_hashes } as T) : null;
          }

          return null;
        },
        all: async <T = unknown>() => {
          // SELECT agent_id, hash FROM agent_sync_hashes WHERE chain_id = ? AND agent_id IN (...)
          if (query.includes('FROM agent_sync_hashes') && query.includes('SELECT agent_id, hash')) {
            const chainId = values[0] as string;
            const agentIds = values.slice(1) as string[];
            const results: Array<{ agent_id: string; hash: string }> = [];
            for (const agentId of agentIds) {
              const key = `${chainId}:${agentId}`;
              const row = self.agentHashes.get(key);
              if (row) {
                results.push({ agent_id: agentId, hash: row.hash });
              }
            }
            return { success: true, results: results as unknown as T[] };
          }

          return { success: true, results: [] as T[] };
        },
        run: async () => {
          // Upsert sync_state last_updated_at
          if (query.includes('INSERT INTO sync_state') && query.includes('ON CONFLICT(chain_id)')) {
            const [chainId, lastUpdatedAt] = values as [string, string];
            const existing = self.syncState.get(chainId);
            self.syncState.set(chainId, {
              last_updated_at: lastUpdatedAt,
              agent_hashes: existing?.agent_hashes ?? null,
            });
            return { success: true, meta: {} };
          }

          // UPDATE sync_state SET agent_hashes = NULL
          if (query.includes('UPDATE sync_state SET agent_hashes = NULL WHERE chain_id = ?')) {
            const chainId = values[0] as string;
            const existing = self.syncState.get(chainId);
            if (existing) {
              self.syncState.set(chainId, { ...existing, agent_hashes: null });
            }
            return { success: true, meta: {} };
          }

          // INSERT INTO agent_sync_hashes ... (multi-row)
          if (query.includes('INSERT INTO agent_sync_hashes')) {
            // binds come in tuples: (chain_id, agent_id, hash, updated_at)
            for (let i = 0; i < values.length; i += 4) {
              const chainId = values[i] as string;
              const agentId = values[i + 1] as string;
              const hash = values[i + 2] as string;
              const updated_at = values[i + 3] as string;
              self.agentHashes.set(`${chainId}:${agentId}`, { hash, updated_at });
            }
            return { success: true, meta: {} };
          }

          // DELETE FROM agent_sync_hashes WHERE chain_id = ? AND agent_id IN (...)
          if (query.includes('DELETE FROM agent_sync_hashes') && query.includes('agent_id IN')) {
            const chainId = values[0] as string;
            const agentIds = values.slice(1) as string[];
            for (const agentId of agentIds) {
              self.agentHashes.delete(`${chainId}:${agentId}`);
            }
            return { success: true, meta: {} };
          }

          return { success: true, meta: {} };
        },
      }),
    };
  }

  // Not used by these tests
  async exec() {
    return { success: true, meta: {} };
  }
}

describe('D1SemanticSyncStateStoreV2', () => {
  let db: MockD1Database;
  let store: D1SemanticSyncStateStoreV2;

  beforeEach(() => {
    db = new MockD1Database();
    store = new D1SemanticSyncStateStoreV2(db as unknown as D1Database);
  });

  it('get/set lastUpdatedAt round-trips', async () => {
    expect(await store.getLastUpdatedAt('11155111')).toBe('0');
    await store.setLastUpdatedAt('11155111', '123');
    expect(await store.getLastUpdatedAt('11155111')).toBe('123');
  });

  it('upsert/get/delete agent hashes work per chain', async () => {
    await store.upsertAgentHashes('11155111', { '11155111:1': 'h1', '11155111:2': 'h2' }, 'now');
    await store.upsertAgentHashes('84532', { '84532:1': 'x1' }, 'now');

    expect(await store.getAgentHashes('11155111', ['11155111:1', '11155111:2', '11155111:3'])).toEqual({
      '11155111:1': 'h1',
      '11155111:2': 'h2',
    });

    await store.deleteAgentHashes('11155111', ['11155111:2']);
    expect(await store.getAgentHashes('11155111', ['11155111:1', '11155111:2'])).toEqual({
      '11155111:1': 'h1',
    });
  });

  it('migrateLegacyAgentHashesBlobToTable backfills then clears blob', async () => {
    db.syncState.set('11155111', {
      last_updated_at: '10',
      agent_hashes: JSON.stringify({ '11155111:1': 'h1', '11155111:2': 'h2' }),
    });

    const result = await store.migrateLegacyAgentHashesBlobToTable('11155111', 1);
    expect(result.migrated).toBe(true);
    expect(result.count).toBe(2);

    expect(await store.getAgentHashes('11155111', ['11155111:1', '11155111:2'])).toEqual({
      '11155111:1': 'h1',
      '11155111:2': 'h2',
    });

    // blob cleared
    expect(db.syncState.get('11155111')?.agent_hashes).toBeNull();
    // last_updated_at preserved
    expect(db.syncState.get('11155111')?.last_updated_at).toBe('10');
  });
});


