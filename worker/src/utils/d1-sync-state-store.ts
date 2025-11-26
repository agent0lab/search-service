import type { D1Database } from '@cloudflare/workers-types';
import type {
  SemanticSyncState,
  SemanticSyncStateStore,
  ChainSyncState,
  LegacySemanticSyncState,
} from './sync-state.js';
import { normalizeSemanticSyncState } from './sync-state.js';

/**
 * D1 database-backed semantic sync state store.
 * Persists sync state across worker invocations for multi-chain indexing.
 */
export class D1SemanticSyncStateStore implements SemanticSyncStateStore {
  constructor(private readonly db: D1Database) {
    if (!db) {
      throw new Error('D1SemanticSyncStateStore requires a D1Database instance');
    }
  }

  async load(): Promise<SemanticSyncState | LegacySemanticSyncState | null> {
    try {
      // Load all chain states from D1
      const result = await this.db
        .prepare('SELECT chain_id, last_updated_at, agent_hashes FROM sync_state')
        .all<{
          chain_id: string;
          last_updated_at: string;
          agent_hashes: string | null;
        }>();

      if (!result.success || !result.results || result.results.length === 0) {
        return null;
      }

      // Build SemanticSyncState from D1 rows
      const chains: Record<string, ChainSyncState> = {};
      for (const row of result.results) {
        let agentHashes: Record<string, string> | undefined;
        if (row.agent_hashes) {
          try {
            agentHashes = JSON.parse(row.agent_hashes);
          } catch (e) {
            console.warn(`Failed to parse agent_hashes for chain ${row.chain_id}:`, e);
          }
        }

        chains[row.chain_id] = {
          lastUpdatedAt: row.last_updated_at || '0',
          agentHashes,
        };
      }

      return { chains };
    } catch (error) {
      console.error('Error loading sync state from D1:', error);
      return null;
    }
  }

  async save(state: SemanticSyncState): Promise<void> {
    try {
      // Use a transaction to ensure atomic updates
      // D1 doesn't support explicit transactions, so we'll do individual upserts
      for (const [chainId, chainState] of Object.entries(state.chains)) {
        const agentHashesJson = chainState.agentHashes
          ? JSON.stringify(chainState.agentHashes)
          : null;

        await this.db
          .prepare(
            'INSERT INTO sync_state (chain_id, last_updated_at, agent_hashes) VALUES (?, ?, ?) ON CONFLICT(chain_id) DO UPDATE SET last_updated_at = ?, agent_hashes = ?'
          )
          .bind(
            chainId,
            chainState.lastUpdatedAt,
            agentHashesJson,
            chainState.lastUpdatedAt,
            agentHashesJson
          )
          .run();
      }

      // Clean up chains that are no longer in state
      const existingChainIds = Object.keys(state.chains);
      if (existingChainIds.length > 0) {
        const placeholders = existingChainIds.map(() => '?').join(',');
        await this.db
          .prepare(`DELETE FROM sync_state WHERE chain_id NOT IN (${placeholders})`)
          .bind(...existingChainIds)
          .run();
      } else {
        // If no chains, clear all state
        await this.db.prepare('DELETE FROM sync_state').run();
      }
    } catch (error) {
      console.error('Error saving sync state to D1:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM sync_state').run();
    } catch (error) {
      console.error('Error clearing sync state from D1:', error);
      throw error;
    }
  }
}

