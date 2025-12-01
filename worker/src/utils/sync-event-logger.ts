import type { D1Database } from '@cloudflare/workers-types';

export interface SyncLogEvent {
  syncLogId: number;
  chainId: number;
  eventType: 'batch-processed' | 'no-op' | 'error';
  timestamp: string;
  agentsIndexed: number;
  agentsDeleted: number;
  agentIdsIndexed?: string[]; // JSON array of agent IDs
  agentIdsDeleted?: string[]; // JSON array of agent IDs
  lastUpdatedAt?: string;
  errorMessage?: string;
}

/**
 * Utility for logging detailed sync events to D1 database
 * Each event represents a batch operation during a chain sync
 */
export class SyncEventLogger {
  constructor(private readonly db: D1Database) {}

  /**
   * Log a sync event (batch processed, no-op, or error)
   */
  async logEvent(event: SyncLogEvent): Promise<void> {
    const agentIdsIndexedJson = event.agentIdsIndexed ? JSON.stringify(event.agentIdsIndexed) : null;
    const agentIdsDeletedJson = event.agentIdsDeleted ? JSON.stringify(event.agentIdsDeleted) : null;

    await this.db
      .prepare(
        'INSERT INTO sync_log_events (sync_log_id, chain_id, event_type, timestamp, agents_indexed, agents_deleted, agent_ids_indexed, agent_ids_deleted, last_updated_at, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        event.syncLogId,
        event.chainId,
        event.eventType,
        event.timestamp,
        event.agentsIndexed,
        event.agentsDeleted,
        agentIdsIndexedJson,
        agentIdsDeletedJson,
        event.lastUpdatedAt || null,
        event.errorMessage || null
      )
      .run();
  }

  /**
   * Get events for a specific sync log
   */
  async getEventsForSyncLog(syncLogId: number): Promise<SyncLogEvent[]> {
    const result = await this.db
      .prepare(
        'SELECT sync_log_id, chain_id, event_type, timestamp, agents_indexed, agents_deleted, agent_ids_indexed, agent_ids_deleted, last_updated_at, error_message FROM sync_log_events WHERE sync_log_id = ? ORDER BY timestamp ASC'
      )
      .bind(syncLogId)
      .all<{
        sync_log_id: number;
        chain_id: number;
        event_type: string;
        timestamp: string;
        agents_indexed: number;
        agents_deleted: number;
        agent_ids_indexed: string | null;
        agent_ids_deleted: string | null;
        last_updated_at: string | null;
        error_message: string | null;
      }>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map((row) => ({
      syncLogId: row.sync_log_id,
      chainId: row.chain_id,
      eventType: row.event_type as 'batch-processed' | 'no-op' | 'error',
      timestamp: row.timestamp,
      agentsIndexed: row.agents_indexed,
      agentsDeleted: row.agents_deleted,
      agentIdsIndexed: row.agent_ids_indexed ? (JSON.parse(row.agent_ids_indexed) as string[]) : undefined,
      agentIdsDeleted: row.agent_ids_deleted ? (JSON.parse(row.agent_ids_deleted) as string[]) : undefined,
      lastUpdatedAt: row.last_updated_at || undefined,
      errorMessage: row.error_message || undefined,
    }));
  }

  /**
   * Get events for a specific chain within a sync log
   */
  async getEventsForChain(syncLogId: number, chainId: number): Promise<SyncLogEvent[]> {
    const result = await this.db
      .prepare(
        'SELECT sync_log_id, chain_id, event_type, timestamp, agents_indexed, agents_deleted, agent_ids_indexed, agent_ids_deleted, last_updated_at, error_message FROM sync_log_events WHERE sync_log_id = ? AND chain_id = ? ORDER BY timestamp ASC'
      )
      .bind(syncLogId, chainId)
      .all<{
        sync_log_id: number;
        chain_id: number;
        event_type: string;
        timestamp: string;
        agents_indexed: number;
        agents_deleted: number;
        agent_ids_indexed: string | null;
        agent_ids_deleted: string | null;
        last_updated_at: string | null;
        error_message: string | null;
      }>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map((row) => ({
      syncLogId: row.sync_log_id,
      chainId: row.chain_id,
      eventType: row.event_type as 'batch-processed' | 'no-op' | 'error',
      timestamp: row.timestamp,
      agentsIndexed: row.agents_indexed,
      agentsDeleted: row.agents_deleted,
      agentIdsIndexed: row.agent_ids_indexed ? (JSON.parse(row.agent_ids_indexed) as string[]) : undefined,
      agentIdsDeleted: row.agent_ids_deleted ? (JSON.parse(row.agent_ids_deleted) as string[]) : undefined,
      lastUpdatedAt: row.last_updated_at || undefined,
      errorMessage: row.error_message || undefined,
    }));
  }
}

