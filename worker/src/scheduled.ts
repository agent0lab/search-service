import type { ScheduledController } from '@cloudflare/workers-types';
import type { Env, ChainSyncMessage } from './types.js';
import { SyncLogger } from './utils/sync-logger.js';
import { getChains, initializeDefaults } from './utils/config-store.js';

/**
 * Scheduled event handler for cron-triggered indexing
 * This handler queues chain sync messages - the queue consumer does all the work
 */
export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  const startTime = Date.now();
  console.log('[CRON] Scheduled indexing triggered:', controller.cron, new Date().toISOString());

  const logger = new SyncLogger(env.DB);
  let logId: number | null = null;

  try {
    console.log('[CRON] Starting queue-based sync process...');
    
    // Validate required environment variables
    if (!env.DB) {
      throw new Error('D1 database (DB) is required');
    }
    if (!env.INDEXING_QUEUE) {
      throw new Error('INDEXING_QUEUE is required for queue-based indexing');
    }

    // Initialize default config if needed
    await initializeDefaults(env.DB);

    // Get chains to sync
    const chains = await getChains(env.DB);
    console.log('[CRON] Configured chains:', chains);
    
    if (chains.length === 0) {
      console.warn('[CRON] No chains configured for indexing');
      return;
    }
    
    // Start logging
    logId = await logger.startLog(chains);
    console.log('[CRON] Started sync log entry:', logId);

    // Queue a sync message for each chain
    // The queue consumer will handle all the work: subgraph paging, embeddings, upserting
    const queuePromises = chains.map(async (chainId) => {
      const message: ChainSyncMessage = {
        type: 'chain-sync',
        chainId: String(chainId), // Convert to string for queue message
        batchSize: 50, // Can be configured per chain if needed
      };
      
      await env.INDEXING_QUEUE.send(message);
      console.log(`[CRON] Queued sync for chain ${chainId}`);
    });

    await Promise.all(queuePromises);
    
    const duration = Date.now() - startTime;

    // Log queuing completion (actual sync happens in queue consumer)
    if (logId !== null) {
      await logger.completeLog(logId, 'success', {
        agentsIndexed: 0, // Will be updated by queue consumer
        agentsDeleted: 0,
        batchesProcessed: 0,
      });
    }

    console.log('[CRON] Queued sync messages for all chains', {
      chains: chains.length,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[CRON] Error in scheduled indexing:', {
      error: errorMessage,
      stack: errorStack,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    
    // Log error
    if (logId !== null) {
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

