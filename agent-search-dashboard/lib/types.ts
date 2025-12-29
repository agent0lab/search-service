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

// Sync log event types
export interface SyncLogEvent {
  id: number;
  sync_log_id: number;
  chain_id: number;
  event_type: 'batch-processed' | 'no-op' | 'error';
  timestamp: string;
  agents_indexed: number;
  agents_deleted: number;
  agent_ids_indexed: string | null; // JSON string
  agent_ids_deleted: string | null; // JSON string
  last_updated_at: string | null;
  error_message: string | null;
}

export interface SyncLogEventEntry {
  id: number;
  syncLogId: number;
  chainId: number;
  eventType: 'batch-processed' | 'no-op' | 'error';
  timestamp: string;
  agentsIndexed: number;
  agentsDeleted: number;
  agentIdsIndexed?: string[];
  agentIdsDeleted?: string[];
  lastUpdatedAt?: string;
  errorMessage?: string;
}

// Search types (matching worker API)
export interface SemanticSearchFilters {
  capabilities?: string[];
  defaultInputMode?: string;
  defaultOutputMode?: string;
  minScore?: number;
  chainId?: number | { $in: number[] }; // Support single chain or multiple chains
  tags?: string[];
  [key: string]: unknown;
}

export interface SemanticSearchResult {
  rank: number;
  vectorId: string;
  agentId: string;
  chainId: number;
  name?: string;
  description?: string;
  score: number;
  metadata?: Record<string, unknown>;
  matchReasons?: string[];
}

export interface SemanticSearchResponse {
  query: string;
  results: SemanticSearchResult[];
  total: number;
  timestamp: string;
}

// Session types
export interface Session {
  address: string;
  issuedAt: number;
  expiresAt: number;
}

// v1 API schema types (search service)
// Filter Operators
export interface StandardFilters {
  equals?: Record<string, unknown>;
  in?: Record<string, unknown[]>;
  notIn?: Record<string, unknown[]>;
  exists?: string[];
  notExists?: string[];
}

// Search Request (v1)
export interface StandardSearchRequest {
  query: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  filters?: StandardFilters;
  minScore?: number;
  includeMetadata?: boolean;
  // Optional extensions for SearchParams compatibility
  name?: string; // Substring search for name (post-filtered)
  chains?: number[] | 'all'; // Multi-chain search support
  sort?: string[]; // Sort by fields (e.g., ["updatedAt:desc", "name:asc"])
}

// Pagination Metadata
export interface PaginationMetadata {
  hasMore: boolean;
  nextCursor?: string;
  limit: number;
  offset?: number;
}

// Search Result (v1)
export interface StandardSearchResult {
  rank: number;
  vectorId: string;
  agentId: string;
  chainId: number;
  name: string;
  description: string;
  score: number;
  metadata?: StandardMetadata;
  matchReasons?: string[];
}

// Metadata fields (AgentRegistrationFile fields)
export interface StandardMetadata {
  id?: string;
  cid?: string;
  agentId?: string;
  name?: string;
  description?: string;
  image?: string;
  active?: boolean;
  x402support?: boolean;
  supportedTrusts?: string[];
  mcpEndpoint?: string;
  mcpVersion?: string;
  a2aEndpoint?: string;
  a2aVersion?: string;
  ens?: string;
  did?: string;
  agentWallet?: string;
  agentWalletChainId?: number;
  mcpTools?: string[];
  mcpPrompts?: string[];
  mcpResources?: string[];
  a2aSkills?: string[];
  agentURI?: string;
  createdAt?: number;
  // Additional fields from current implementation
  capabilities?: string[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  tags?: string[];
  [key: string]: unknown;
}

// Search Response (v1)
export interface StandardSearchResponse {
  query: string;
  results: StandardSearchResult[];
  total: number;
  pagination?: PaginationMetadata;
  requestId: string;
  timestamp: string;
  provider: {
    name: string;
    version: string;
  };
}

// Error Response (v1)
export interface StandardErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'RATE_LIMIT_EXCEEDED' | 'INTERNAL_ERROR' | 'BAD_REQUEST' | 'NOT_FOUND';
  status: number;
  requestId?: string;
  timestamp: string;
}

