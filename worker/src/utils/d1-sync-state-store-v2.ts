// Avoid a hard dependency on `@cloudflare/workers-types` at type-check time.
// The runtime object is provided by Cloudflare; we only need the subset we use here.
type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      all: <T = unknown>() => Promise<{ success: boolean; results?: T[] }>;
      run: () => Promise<{ success: boolean; meta: unknown }>;
    };
  };
};

/**
 * Batch-oriented D1 store for semantic sync state.
 *
 * - Keeps per-chain cursor in `sync_state.last_updated_at`
 * - Stores per-agent hash in `agent_sync_hashes` (normalized, one row per agent)
 *
 * This avoids reading/writing large per-chain JSON blobs.
 */
export class D1SemanticSyncStateStoreV2 {
  constructor(private readonly db: D1Database) {
    if (!db) {
      throw new Error('D1SemanticSyncStateStoreV2 requires a D1Database instance');
    }
  }

  async getLastUpdatedAt(chainId: string): Promise<string> {
    const row = await this.db
      .prepare('SELECT last_updated_at FROM sync_state WHERE chain_id = ?')
      .bind(chainId)
      .first<{ last_updated_at: string }>();

    return row?.last_updated_at ?? '0';
  }

  async setLastUpdatedAt(chainId: string, lastUpdatedAt: string): Promise<void> {
    // Upsert row; do not touch legacy agent_hashes column beyond setting NULL on insert.
    await this.db
      .prepare(
        `INSERT INTO sync_state (chain_id, last_updated_at, agent_hashes)
         VALUES (?, ?, NULL)
         ON CONFLICT(chain_id) DO UPDATE SET last_updated_at = excluded.last_updated_at`
      )
      .bind(chainId, lastUpdatedAt)
      .run();
  }

  async getAgentHashes(chainId: string, agentIds: string[]): Promise<Record<string, string>> {
    if (!agentIds || agentIds.length === 0) {
      return {};
    }

    const placeholders = agentIds.map(() => '?').join(',');
    const result = await this.db
      .prepare(
        `SELECT agent_id, hash
         FROM agent_sync_hashes
         WHERE chain_id = ? AND agent_id IN (${placeholders})`
      )
      .bind(chainId, ...agentIds)
      .all<{ agent_id: string; hash: string }>();

    const out: Record<string, string> = {};
    if (!result.success || !result.results) {
      return out;
    }

    for (const row of result.results) {
      if (row.agent_id && row.hash) {
        out[row.agent_id] = row.hash;
      }
    }
    return out;
  }

  async upsertAgentHashes(
    chainId: string,
    hashes: Record<string, string>,
    nowIso: string = new Date().toISOString()
  ): Promise<void> {
    const entries = Object.entries(hashes).filter(([, hash]) => typeof hash === 'string' && hash.length > 0);
    if (entries.length === 0) {
      return;
    }

    // Cloudflare D1 has a limit of 100 bound parameters per query (not SQLite's 999).
    // We need 4 values per row (chainId, agentId, hash, updated_at), so max 25 rows per batch.
    // Use 24 to stay safely under the limit (24 * 4 = 96 parameters).
    const maxBatchSize = 24;
    
    for (let i = 0; i < entries.length; i += maxBatchSize) {
      const batch = entries.slice(i, i + maxBatchSize);
      const valuesSql = batch.map(() => '(?, ?, ?, ?)').join(', ');
      const sql = `
        INSERT INTO agent_sync_hashes (chain_id, agent_id, hash, updated_at)
        VALUES ${valuesSql}
        ON CONFLICT(chain_id, agent_id) DO UPDATE SET
          hash = excluded.hash,
          updated_at = excluded.updated_at
      `;

      const binds: unknown[] = [];
      for (const [agentId, hash] of batch) {
        binds.push(chainId, agentId, hash, nowIso);
      }

      await this.db.prepare(sql).bind(...binds).run();
    }
  }

  async deleteAgentHashes(chainId: string, agentIds: string[]): Promise<void> {
    if (!agentIds || agentIds.length === 0) {
      return;
    }

    const placeholders = agentIds.map(() => '?').join(',');
    await this.db
      .prepare(
        `DELETE FROM agent_sync_hashes
         WHERE chain_id = ? AND agent_id IN (${placeholders})`
      )
      .bind(chainId, ...agentIds)
      .run();
  }

  /**
   * Reads legacy JSON blob hashes from `sync_state.agent_hashes` for the given chain
   * and returns them (without modifying DB).
   */
  async readLegacyAgentHashesBlob(chainId: string): Promise<Record<string, string> | null> {
    const row = await this.db
      .prepare('SELECT agent_hashes FROM sync_state WHERE chain_id = ?')
      .bind(chainId)
      .first<{ agent_hashes: string | null }>();

    if (!row?.agent_hashes) {
      return null;
    }

    try {
      const parsed = JSON.parse(row.agent_hashes) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      const obj = parsed as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') {
          out[k] = v;
        }
      }
      return out;
    } catch {
      return null;
    }
  }

  /**
   * One-time migration helper:
   * - If `sync_state.agent_hashes` contains a legacy JSON blob for this chain, upsert it into
   *   `agent_sync_hashes` and then clear the blob column.
   *
   * Idempotent: safe to call repeatedly; if blob is already NULL, it becomes a no-op.
   */
  async migrateLegacyAgentHashesBlobToTable(
    chainId: string,
    chunkSize: number = 500
  ): Promise<{ migrated: boolean; count: number }> {
    const legacy = await this.readLegacyAgentHashesBlob(chainId);
    if (!legacy) {
      return { migrated: false, count: 0 };
    }

    const entries = Object.entries(legacy);
    const nowIso = new Date().toISOString();

    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const chunkMap: Record<string, string> = {};
      for (const [agentId, hash] of chunk) {
        chunkMap[agentId] = hash;
      }
      await this.upsertAgentHashes(chainId, chunkMap, nowIso);
    }

    // Clear legacy blob but preserve last_updated_at.
    await this.db
      .prepare('UPDATE sync_state SET agent_hashes = NULL WHERE chain_id = ?')
      .bind(chainId)
      .run();

    return { migrated: true, count: entries.length };
  }
}


