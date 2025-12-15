/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // Venice AI
  VENICE_API_KEY: string;
  
  // Pinecone
  PINECONE_API_KEY: string;
  PINECONE_INDEX: string;
  PINECONE_NAMESPACE?: string;
  
  // D1 Database for sync state storage
  DB: D1Database;
  
  // RPC URL for blockchain access
  RPC_URL: string;
  
  // Cloudflare Queue for indexing operations
  INDEXING_QUEUE: Queue<IndexingQueueMessage>;
}

/**
 * Queue message types for indexing operations
 */
export type IndexingQueueMessage = ChainSyncMessage;

/**
 * Message for syncing a single chain
 * The queue consumer will handle all the work: subgraph paging, embedding generation, upserting
 */
export interface ChainSyncMessage {
  type: 'chain-sync';
  chainId: string;
  batchSize?: number; // Optional, defaults to 50
  subgraphUrl?: string; // Optional, for custom subgraph URLs
  logId?: number; // Optional, sync log ID to update with stats
}

/**
 * Validation constants for production readiness
 */
export const MAX_QUERY_LENGTH = 1000;
export const MAX_TOP_K = 100;
export const MAX_REQUEST_SIZE = 10240; // 10KB

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  windowSizeMs: number;
}

/**
 * Provider metadata constants
 */
export const PROVIDER_NAME = 'agent0-semantic-search';
export const PROVIDER_VERSION = '1.0.0';

