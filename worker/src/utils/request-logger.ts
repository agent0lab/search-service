import type { D1Database } from '@cloudflare/workers-types';
import type { SemanticSearchFilters } from '../types.js';

export interface RequestLogEntry {
  id: number;
  timestamp: string;
  ipAddress: string;
  query: string;
  topK?: number;
  filters?: SemanticSearchFilters;
  responseCount: number;
  durationMs?: number;
  statusCode: number;
  errorMessage?: string;
}

/**
 * Utility for logging search requests to D1 database
 */
export class RequestLogger {
  constructor(private readonly db: D1Database) {}

  /**
   * Log a search request
   */
  async logRequest(params: {
    ipAddress: string;
    query: string;
    topK?: number;
    filters?: SemanticSearchFilters;
    responseCount: number;
    durationMs?: number;
    statusCode: number;
    errorMessage?: string;
  }): Promise<void> {
    const timestamp = new Date().toISOString();
    const filtersJson = params.filters ? JSON.stringify(params.filters) : null;

    await this.db
      .prepare(
        'INSERT INTO request_logs (timestamp, ip_address, query, top_k, filters, response_count, duration_ms, status_code, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        timestamp,
        params.ipAddress,
        params.query,
        params.topK || null,
        filtersJson,
        params.responseCount,
        params.durationMs || null,
        params.statusCode,
        params.errorMessage || null
      )
      .run();
  }

  /**
   * Get recent request logs (most recent first)
   */
  async getRecentRequests(limit: number = 50): Promise<RequestLogEntry[]> {
    const result = await this.db
      .prepare(
        'SELECT id, timestamp, ip_address, query, top_k, filters, response_count, duration_ms, status_code, error_message FROM request_logs ORDER BY timestamp DESC LIMIT ?'
      )
      .bind(limit)
      .all<{
        id: number;
        timestamp: string;
        ip_address: string;
        query: string;
        top_k: number | null;
        filters: string | null;
        response_count: number;
        duration_ms: number | null;
        status_code: number;
        error_message: string | null;
      }>();

    if (!result.success || !result.results) {
      return [];
    }

    return result.results.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      ipAddress: row.ip_address,
      query: row.query,
      topK: row.top_k || undefined,
      filters: row.filters ? (JSON.parse(row.filters) as SemanticSearchFilters) : undefined,
      responseCount: row.response_count,
      durationMs: row.duration_ms || undefined,
      statusCode: row.status_code,
      errorMessage: row.error_message || undefined,
    }));
  }

  /**
   * Get request count for an IP address within a time window
   */
  async getRequestCount(ipAddress: string, since: Date): Promise<number> {
    const sinceIso = since.toISOString();
    const result = await this.db
      .prepare(
        'SELECT COUNT(*) as count FROM request_logs WHERE ip_address = ? AND timestamp >= ?'
      )
      .bind(ipAddress, sinceIso)
      .first<{ count: number }>();

    return result?.count || 0;
  }
}

