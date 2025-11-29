import type { D1Database } from '@cloudflare/workers-types';

export interface SyncLogEntry {
  startedAt: string;
  completedAt?: string;
  status: 'success' | 'error' | 'in_progress';
  chains: number[];
  agentsIndexed: number;
  agentsDeleted: number;
  batchesProcessed: number;
  errorMessage?: string;
  durationMs?: number;
}

/**
 * Utility for logging indexing sync runs to D1 database
 */
export class SyncLogger {
  constructor(private readonly db: D1Database) {}

  /**
   * Create a new sync log entry and return its ID
   */
  async startLog(chains: number[]): Promise<number> {
    const startedAt = new Date().toISOString();
    const chainsJson = JSON.stringify(chains);

    const result = await this.db
      .prepare(
        'INSERT INTO sync_logs (started_at, status, chains, agents_indexed, agents_deleted, batches_processed) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
      )
      .bind(startedAt, 'in_progress', chainsJson, 0, 0, 0)
      .first<{ id: number }>();

    if (!result || !result.id) {
      throw new Error('Failed to create sync log entry');
    }

    return result.id;
  }

  /**
   * Update a sync log entry with completion information
   */
  async completeLog(
    logId: number,
    status: 'success' | 'error',
    stats: {
      agentsIndexed: number;
      agentsDeleted: number;
      batchesProcessed: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    const completedAt = new Date().toISOString();
    const startedAtResult = await this.db
      .prepare('SELECT started_at FROM sync_logs WHERE id = ?')
      .bind(logId)
      .first<{ started_at: string }>();

    let durationMs: number | undefined;
    if (startedAtResult?.started_at) {
      const startTime = new Date(startedAtResult.started_at).getTime();
      const endTime = new Date(completedAt).getTime();
      durationMs = endTime - startTime;
    }

    await this.db
      .prepare(
        'UPDATE sync_logs SET completed_at = ?, status = ?, agents_indexed = ?, agents_deleted = ?, batches_processed = ?, error_message = ?, duration_ms = ? WHERE id = ?'
      )
      .bind(
        completedAt,
        status,
        stats.agentsIndexed,
        stats.agentsDeleted,
        stats.batchesProcessed,
        stats.errorMessage || null,
        durationMs || null,
        logId
      )
      .run();
  }

  /**
   * Get recent sync logs (most recent first)
   */
  async getRecentLogs(limit: number = 50): Promise<SyncLogEntry[]> {
    const result = await this.db
      .prepare(
        'SELECT id, started_at, completed_at, status, chains, agents_indexed, agents_deleted, batches_processed, error_message, duration_ms FROM sync_logs ORDER BY started_at DESC LIMIT ?'
      )
      .bind(limit)
      .all<{
        id: number;
        started_at: string;
        completed_at: string | null;
        status: string;
        chains: string;
        agents_indexed: number;
        agents_deleted: number;
        batches_processed: number;
        error_message: string | null;
        duration_ms: number | null;
      }>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map((row) => ({
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      status: row.status as 'success' | 'error' | 'in_progress',
      chains: JSON.parse(row.chains) as number[],
      agentsIndexed: row.agents_indexed,
      agentsDeleted: row.agents_deleted,
      batchesProcessed: row.batches_processed,
      errorMessage: row.error_message || undefined,
      durationMs: row.duration_ms || undefined,
    }));
  }
}




