import type { ScheduledEvent } from '@cloudflare/workers-types';
import type { Env } from './types.js';
import { IndexingService } from './services/indexing-service.js';
import { SyncLogger } from './utils/sync-logger.js';
import { getChains } from './utils/config-store.js';

/**
 * Scheduled event handler for cron-triggered indexing
 * This handler is automatically protected - only Cloudflare's cron system can trigger it
 */
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Scheduled indexing triggered:', event.cron);

  const logger = new SyncLogger(env.DB);
  let logId: number | null = null;

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

    // Get chains for logging
    const chains = await getChains(env.DB);
    
    // Start logging
    logId = await logger.startLog(chains);

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
    const stats = await indexingService.sync();

    // Log successful completion
    if (logId !== null) {
      await logger.completeLog(logId, 'success', stats);
    }

    console.log('Scheduled indexing completed successfully', stats);
  } catch (error) {
    console.error('Error in scheduled indexing:', error);
    
    // Log error
    if (logId !== null) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logger.completeLog(logId, 'error', {
        agentsIndexed: 0,
        agentsDeleted: 0,
        batchesProcessed: 0,
        errorMessage,
      });
    }
    
    // Don't throw - allow the scheduled event to complete
    // Errors are logged for monitoring
  }
}

