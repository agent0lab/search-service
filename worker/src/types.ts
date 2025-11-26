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
}

