import type { D1Database } from '@cloudflare/workers-types';
import type { RequestLog, IndexingLog, WhitelistEntry, DashboardStats } from './types';

export class D1Client {
  constructor(private db: D1Database) {}

  // Request Logs
  async getRequestLogs(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      startDate?: string;
      endDate?: string;
      statusCode?: number;
      ipAddress?: string;
      query?: string;
    }
  ): Promise<RequestLog[]> {
    let query = 'SELECT * FROM request_logs WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }
    if (filters?.statusCode) {
      query += ' AND status_code = ?';
      params.push(filters.statusCode);
    }
    if (filters?.ipAddress) {
      query += ' AND ip_address = ?';
      params.push(filters.ipAddress);
    }
    if (filters?.query) {
      query += ' AND query LIKE ?';
      params.push(`%${filters.query}%`);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await this.db.prepare(query).bind(...params).all<RequestLog>();
    return result.results || [];
  }

  async getRequestLogsCount(filters?: {
    startDate?: string;
    endDate?: string;
    statusCode?: number;
  }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM request_logs WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }
    if (filters?.statusCode) {
      query += ' AND status_code = ?';
      params.push(filters.statusCode);
    }

    const result = await this.db.prepare(query).bind(...params).first<{ count: number }>();
    return result?.count || 0;
  }

  // Indexing Logs
  async getIndexingLogs(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      startDate?: string;
      endDate?: string;
      status?: string;
    }
  ): Promise<IndexingLog[]> {
    let query = 'SELECT * FROM sync_logs WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.startDate) {
      query += ' AND started_at >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ' AND started_at <= ?';
      params.push(filters.endDate);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await this.db.prepare(query).bind(...params).all<IndexingLog>();
    return result.results || [];
  }

  async getIndexingLogsCount(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM sync_logs WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.startDate) {
      query += ' AND started_at >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ' AND started_at <= ?';
      params.push(filters.endDate);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    const result = await this.db.prepare(query).bind(...params).first<{ count: number }>();
    return result?.count || 0;
  }

  // Dashboard Stats
  async getDashboardStats(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<DashboardStats> {
    const now = new Date();
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
    const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

    // Request stats
    const requestStats = await this.db
      .prepare(
        `SELECT 
          COUNT(*) as total,
          AVG(duration_ms) as avg_duration,
          COUNT(CASE WHEN status_code = 200 THEN 1 END) as success_count,
          COUNT(CASE WHEN status_code != 200 THEN 1 END) as error_count
        FROM request_logs
        WHERE timestamp >= ?`
      )
      .bind(startDate)
      .first<{
        total: number;
        avg_duration: number | null;
        success_count: number;
        error_count: number;
      }>();

    // Indexing stats
    const indexingStats = await this.db
      .prepare(
        `SELECT 
          COUNT(*) as total_runs,
          SUM(agents_indexed) as total_indexed,
          SUM(agents_deleted) as total_deleted,
          MAX(started_at) as last_sync
        FROM sync_logs
        WHERE started_at >= ?`
      )
      .bind(startDate)
      .first<{
        total_runs: number;
        total_indexed: number | null;
        total_deleted: number | null;
        last_sync: string | null;
      }>();

    return {
      totalRequests: requestStats?.total || 0,
      avgDuration: requestStats?.avg_duration || 0,
      successCount: requestStats?.success_count || 0,
      errorCount: requestStats?.error_count || 0,
      totalIndexingRuns: indexingStats?.total_runs || 0,
      totalAgentsIndexed: indexingStats?.total_indexed || 0,
      totalAgentsDeleted: indexingStats?.total_deleted || 0,
      lastSyncTime: indexingStats?.last_sync || null,
    };
  }

  // Whitelist
  async getWhitelist(): Promise<WhitelistEntry[]> {
    const result = await this.db
      .prepare('SELECT * FROM admin_whitelist ORDER BY added_at DESC')
      .all<WhitelistEntry>();
    return result.results || [];
  }

  async isWhitelisted(address: string): Promise<boolean> {
    const result = await this.db
      .prepare('SELECT 1 FROM admin_whitelist WHERE wallet_address = LOWER(?)')
      .bind(address)
      .first();
    return !!result;
  }

  async addToWhitelist(address: string, addedBy: string): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO admin_whitelist (wallet_address, added_at, added_by) VALUES (LOWER(?), ?, ?)'
      )
      .bind(address, new Date().toISOString(), addedBy)
      .run();
  }

  async removeFromWhitelist(address: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM admin_whitelist WHERE wallet_address = LOWER(?)')
      .bind(address)
      .run();
  }
}

