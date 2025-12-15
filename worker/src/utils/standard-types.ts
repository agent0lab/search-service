/**
 * Standard API v1 types matching the Universal Agent Semantic Search API Standard v1.0
 */

// Filter Operators
export interface StandardFilters {
  equals?: Record<string, unknown>;
  in?: Record<string, unknown[]>;
  notIn?: Record<string, unknown[]>;
  exists?: string[];
  notExists?: string[];
}

// Search Request
export interface StandardSearchRequest {
  query: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  filters?: StandardFilters;
  minScore?: number;
  includeMetadata?: boolean;
}

// Pagination Metadata
export interface PaginationMetadata {
  hasMore: boolean;
  nextCursor?: string;
  limit: number;
  offset?: number;
}

// Search Result
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

// Standard Metadata (AgentRegistrationFile fields)
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

// Search Response
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

// Capabilities Response
export interface CapabilitiesResponse {
  version: string;
  limits: {
    maxQueryLength: number;
    maxLimit: number;
    maxFilters: number;
    maxRequestSize: number;
  };
  supportedFilters: string[];
  supportedOperators: string[];
  features: {
    pagination: boolean;
    cursorPagination: boolean;
    metadataFiltering: boolean;
    scoreThreshold: boolean;
  };
}

// Enhanced Health Response
export interface StandardHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  services: {
    embedding: 'ok' | 'error';
    vectorStore: 'ok' | 'error';
  };
  uptime?: number;
}

// Error Response
export interface StandardErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR' | 'RATE_LIMIT_EXCEEDED' | 'INTERNAL_ERROR' | 'BAD_REQUEST' | 'NOT_FOUND';
  status: number;
  requestId?: string;
  timestamp: string;
}

// Cursor structure for pagination
export interface CursorData {
  offset: number;
  timestamp?: string;
}


