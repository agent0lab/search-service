// Database types (for D1)
export interface RequestLog {
  id: number;
  timestamp: string;
  ip_address: string;
  query: string;
  top_k: number | null;
  filters: string | null; // JSON string
  response_count: number;
  duration_ms: number | null;
  status_code: number;
  error_message: string | null;
}

// Frontend types (camelCase)
export interface RequestLogEntry {
  id: number;
  timestamp: string;
  ipAddress: string;
  query: string;
  topK?: number;
  filters?: Record<string, unknown>;
  responseCount: number;
  durationMs: number;
  statusCode: number;
  errorMessage?: string;
}

export interface IndexingLog {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: 'success' | 'error' | 'in_progress';
  chains: string; // JSON array
  agents_indexed: number;
  agents_deleted: number;
  batches_processed: number;
  error_message: string | null;
  duration_ms: number | null;
}

export interface IndexingLogEntry {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: 'success' | 'error' | 'in_progress';
  chains: string; // JSON array
  agents_indexed: number;
  agents_deleted: number;
  batches_processed: number;
  error_message: string | null;
  duration_ms: number | null;
}

export interface WhitelistEntry {
  id: number;
  wallet_address: string;
  added_at: string;
  added_by: string;
}

export interface DashboardStats {
  totalRequests: number;
  avgDuration: number;
  successCount: number;
  errorCount: number;
  totalIndexingRuns: number;
  totalAgentsIndexed: number;
  totalAgentsDeleted: number;
  lastSyncTime: string | null;
}

// Session types
export interface Session {
  address: string;
  issuedAt: number;
  expiresAt: number;
}

