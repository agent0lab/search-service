import type { ScheduledEvent } from '@cloudflare/workers-types';
import type { Env } from './types.js';
import { IndexingService } from './services/indexing-service.js';

/**
 * Scheduled event handler for cron-triggered indexing
 * This handler is automatically protected - only Cloudflare's cron system can trigger it
 */
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Scheduled indexing triggered:', event.cron);

  try {
    // Validate required environment variables
    if (!env.DB) {
      throw new Error('D1 database (DB) is required');
    }
    if (!env.RPC_URL) {
      throw new Error('RPC_URL is required');
    }
    if (!env.VENICE_API_KEY) {
      throw new Error('VENICE_API_KEY is required');
    }
    if (!env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required');
    }
    if (!env.PINECONE_INDEX) {
      throw new Error('PINECONE_INDEX is required');
    }

    // Create indexing service
    const indexingService = new IndexingService({
      db: env.DB,
      rpcUrl: env.RPC_URL,
      veniceApiKey: env.VENICE_API_KEY,
      pineconeApiKey: env.PINECONE_API_KEY,
      pineconeIndex: env.PINECONE_INDEX,
      pineconeNamespace: env.PINECONE_NAMESPACE,
      batchSize: 50,
    });

    // Perform sync
    await indexingService.sync();

    console.log('Scheduled indexing completed successfully');
  } catch (error) {
    console.error('Error in scheduled indexing:', error);
    // Don't throw - allow the scheduled event to complete
    // Errors are logged for monitoring
  }
}

