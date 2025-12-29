import type { MessageBatch } from '@cloudflare/workers-types';
import type { Env, ChainSyncMessage } from './types.js';
import { SDK } from 'agent0-sdk';
import { SemanticSyncRunner, type SemanticSyncRunnerOptions } from './utils/semantic-sync-runner.js';
import { PineconeVectorStore } from './utils/providers/pinecone-vector-store.js';
import { VeniceEmbeddingProvider } from './utils/providers/venice-embedding.js';
import { D1SemanticSyncStateStoreV2 } from './utils/d1-sync-state-store-v2.js';
import { SyncLockManager } from './utils/sync-lock.js';
import { SyncLogger } from './utils/sync-logger.js';
import { SyncEventLogger } from './utils/sync-event-logger.js';
import { resolveSubgraphUrlForChain } from './utils/subgraph-config.js';

/**
 * Queue consumer handler for processing chain sync operations
 * Each message triggers a full sync for one chain: subgraph paging, embedding generation, upserting
 */
export async function queue(
  batch: MessageBatch<ChainSyncMessage>,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`[queue] Processing batch of ${batch.messages.length} chain sync messages`);

  // Deduplicate messages for the same chain - only process the first one for each chain
  const chainSyncMap = new Map<string, typeof batch.messages[0]>();
  const otherMessages: Array<typeof batch.messages[0]> = [];

  for (const message of batch.messages) {
    const body = message.body;
    if (body.type === 'chain-sync') {
      const chainId = body.chainId;
      // Only keep the first message for each chain
      if (!chainSyncMap.has(chainId)) {
        chainSyncMap.set(chainId, message);
      } else {
        console.log(`[queue] Deduplicating: skipping duplicate sync message for chain ${chainId}`);
        // Acknowledge duplicate messages immediately
        message.ack();
      }
    } else {
      otherMessages.push(message);
    }
  }

  console.log(`[queue] Deduplicated: processing ${chainSyncMap.size} unique chain syncs from ${batch.messages.length} messages`);

  // Process unique chain syncs first
  for (const message of chainSyncMap.values()) {
    try {
      const body = message.body;

      if (body.type === 'chain-sync') {
        await processChainSync(body, env, ctx);
      }

      // Acknowledge successful processing
      message.ack();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Check if it's a "sync already in progress" error (should not retry)
      if (errorMessage.includes('already in progress')) {
        console.log(`[queue] Sync already in progress for message ${message.id}, skipping`);
        message.ack(); // Acknowledge to remove from queue
      } else {
        console.error(`[queue] Error processing message:`, {
          error: errorMessage,
          stack: errorStack,
          messageId: message.id,
        });

        // Retry on error (Cloudflare Queues will automatically retry)
        message.retry();
      }
    }
  }

  // Process other message types
  for (const message of otherMessages) {
    try {
      console.warn(`[queue] Unknown message type: ${(message.body as any).type}`);
      message.ack();
    } catch (error) {
      console.error(`[queue] Error processing other message:`, error);
      message.retry();
    }
  }

  console.log(`[queue] Batch processing completed`);
}

/**
 * Process a chain sync message - does the full sync for one chain
 */
async function processChainSync(
  message: ChainSyncMessage,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const chainId = Number(message.chainId); // Convert string to number for SDK
  if (Number.isNaN(chainId)) {
    throw new Error(`Invalid chainId: ${message.chainId}`);
  }
  const chainIdStr = String(chainId);
  const batchSize = message.batchSize || 50;
  
  console.log(`[queue] Starting chain sync for chain ${chainId} (batch size: ${batchSize}, logId: ${message.logId || 'none'})`);

  // Check for concurrent sync using lock manager
  const lockManager = new SyncLockManager(env.DB);
  
  // Try to acquire lock - if it fails, another sync is in progress
  const lockAcquired = await lockManager.tryAcquireLock(chainIdStr);
  if (!lockAcquired) {
    const isCurrentlyLocked = await lockManager.isLocked(chainIdStr);
    if (isCurrentlyLocked) {
      console.log(`[queue] Sync already in progress for chain ${chainId}, skipping this message`);
      throw new Error(`Sync already in progress for chain ${chainId}`);
    }
    // If not locked but we couldn't acquire, try once more after a brief delay
    await new Promise(resolve => setTimeout(resolve, 100));
    const retryLockAcquired = await lockManager.tryAcquireLock(chainIdStr);
    if (!retryLockAcquired) {
      console.log(`[queue] Could not acquire lock for chain ${chainId} after retry, skipping`);
      throw new Error(`Sync already in progress for chain ${chainId}`);
    }
  }

  // Track statistics for this chain sync
  let agentsIndexed = 0;
  let agentsDeleted = 0;
  let batchesProcessed = 0;
  let syncError: string | undefined;

  try {
    // Create sync state store
    const stateStore = new D1SemanticSyncStateStoreV2(env.DB);

    // Create embedding provider
    const embeddingProvider = new VeniceEmbeddingProvider({
      apiKey: env.VENICE_API_KEY,
      model: 'text-embedding-bge-m3',
    });

    // Create Pinecone vector store
    const pineconeStore = new PineconeVectorStore({
      apiKey: env.PINECONE_API_KEY,
      index: env.PINECONE_INDEX,
      namespace: env.PINECONE_NAMESPACE,
    });

    // Initialize Pinecone
    try {
      await pineconeStore.initialize();
      console.log(`[queue] Pinecone initialized for chain ${chainId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize Pinecone for chain ${chainId}: ${errorMessage}`);
    }

    // Resolve subgraph URL for this chain (message override > D1/env/defaults)
    const resolvedSubgraphUrl =
      message.subgraphUrl ?? (await resolveSubgraphUrlForChain(env.DB, env as unknown as Record<string, unknown>, chainId));

    // Initialize SDK (optional, mainly for subgraph URL resolution if needed)
    const sdk = new SDK({
      chainId,
      rpcUrl: env.RPC_URL,
      ...(resolvedSubgraphUrl ? { subgraphOverrides: { [chainId]: resolvedSubgraphUrl } } : {}),
    });

    // Create event logger for detailed event tracking
    const eventLogger = message.logId ? new SyncEventLogger(env.DB) : null;

    // Create sync runner for this chain
    const targets = resolvedSubgraphUrl ? [{ chainId, subgraphUrl: resolvedSubgraphUrl }] : [{ chainId }];
      
    const options: SemanticSyncRunnerOptions = {
      batchSize,
      stateStore,
      embeddingProvider,
      vectorStoreProvider: pineconeStore,
      logger: (event: string, extra?: Record<string, unknown>) => {
        console.log(`[queue:chain-${chainId}] ${event}`, extra ?? {});
        
        // Track statistics from log events
        if (event === 'semantic-sync:batch-processed' && extra) {
          batchesProcessed++;
          if (typeof extra.indexed === 'number') {
            agentsIndexed += extra.indexed;
          }
          if (typeof extra.deleted === 'number') {
            agentsDeleted += extra.deleted;
          }

          // Log detailed event if we have a logId (fire-and-forget, don't block)
          if (eventLogger && message.logId) {
            eventLogger.logEvent({
              syncLogId: message.logId,
              chainId,
              eventType: 'batch-processed',
              timestamp: new Date().toISOString(),
              agentsIndexed: typeof extra.indexed === 'number' ? extra.indexed : 0,
              agentsDeleted: typeof extra.deleted === 'number' ? extra.deleted : 0,
              agentIdsIndexed: Array.isArray(extra.agentIds) ? extra.agentIds.map(String) : undefined,
              agentIdsDeleted: Array.isArray(extra.agentIdsDeleted) ? extra.agentIdsDeleted.map(String) : undefined,
              lastUpdatedAt: typeof extra.lastUpdatedAt === 'string' ? extra.lastUpdatedAt : undefined,
            }).catch((error) => {
              console.error(`[queue] Failed to log detailed event:`, error);
              // Don't throw - event logging failure shouldn't break the sync
            });
          }
        } else if (event === 'semantic-sync:chain-complete' && extra) {
          // Track final stats from chain completion
          if (typeof extra.indexed === 'number') {
            agentsIndexed += extra.indexed;
          }
          if (typeof extra.deleted === 'number') {
            agentsDeleted += extra.deleted;
          }
        }
      },
      targets,
    };

    const runner = new SemanticSyncRunner(options, sdk);

    // Run the full sync for this chain
    console.log(`[queue] Running full sync for chain ${chainId}...`);
    const startTime = Date.now();
    
    await runner.run();
    
    const duration = Date.now() - startTime;
    console.log(`[queue] Chain sync completed for chain ${chainId} (duration: ${duration}ms)`, {
      agentsIndexed,
      agentsDeleted,
      batchesProcessed,
    });
  } catch (error) {
    syncError = error instanceof Error ? error.message : String(error);
    console.error(`[queue] Chain sync failed for chain ${chainId}:`, syncError);
    
    // Log error event if we have a logId
    if (message.logId) {
      try {
        const eventLogger = new SyncEventLogger(env.DB);
        await eventLogger.logEvent({
          syncLogId: message.logId,
          chainId,
          eventType: 'error',
          timestamp: new Date().toISOString(),
          agentsIndexed: 0,
          agentsDeleted: 0,
          errorMessage: syncError,
        });
      } catch (logError) {
        console.error(`[queue] Failed to log error event:`, logError);
      }
    }
    
    throw error; // Re-throw to trigger retry logic
  } finally {
    // Always release the lock, even if sync failed
    await lockManager.releaseLock(chainIdStr);
    console.log(`[queue] Released lock for chain ${chainId}`);

    // Update sync log if logId was provided
    if (message.logId) {
      try {
        // Get current log entry to check chains and stats
        const currentLog = await env.DB.prepare(
          'SELECT chains, agents_indexed, agents_deleted, batches_processed, status FROM sync_logs WHERE id = ?'
        )
          .bind(message.logId)
          .first<{ 
            chains: string; 
            agents_indexed: number; 
            agents_deleted: number; 
            batches_processed: number;
            status: string;
          }>();

        if (currentLog) {
          // Parse chains array from JSON
          const expectedChains = JSON.parse(currentLog.chains) as number[];
          
          // Add this chain's stats to the existing totals
          const totalAgentsIndexed = currentLog.agents_indexed + agentsIndexed;
          const totalAgentsDeleted = currentLog.agents_deleted + agentsDeleted;
          const totalBatchesProcessed = currentLog.batches_processed + batchesProcessed;

          // Check if this chain was in the expected chains list
          const chainIndex = expectedChains.indexOf(chainId);
          const isExpectedChain = chainIndex >= 0;

          // Update the log with aggregated stats using atomic increment
          // Use SQL to atomically add to existing values to handle concurrent updates
          await env.DB.prepare(
            'UPDATE sync_logs SET agents_indexed = agents_indexed + ?, agents_deleted = agents_deleted + ?, batches_processed = batches_processed + ? WHERE id = ?'
          )
            .bind(agentsIndexed, agentsDeleted, batchesProcessed, message.logId)
            .run();

          // If there was an error, mark the log as error
          if (syncError) {
            await env.DB.prepare(
              'UPDATE sync_logs SET status = ?, error_message = ? WHERE id = ?'
            )
              .bind('error', syncError, message.logId)
              .run();
          }

          // Check if all chains have completed by counting distinct chains in events
          // Only check if this chain completed successfully (no error)
          if (!syncError) {
            const completedChainsResult = await env.DB.prepare(
              'SELECT COUNT(DISTINCT chain_id) as completed_count FROM sync_log_events WHERE sync_log_id = ? AND event_type != ?'
            )
              .bind(message.logId, 'error')
              .first<{ completed_count: number }>();

            const completedChains = completedChainsResult?.completed_count || 0;
            const expectedChainsCount = expectedChains.length;

            console.log(`[queue] Chain ${chainId} completed. Progress: ${completedChains}/${expectedChainsCount} chains`);

            // If all expected chains have completed, mark the log as success
            if (completedChains >= expectedChainsCount) {
              const logger = new SyncLogger(env.DB);
              
              // Get final stats
              const finalLog = await env.DB.prepare(
                'SELECT agents_indexed, agents_deleted, batches_processed FROM sync_logs WHERE id = ?'
              )
                .bind(message.logId)
                .first<{ 
                  agents_indexed: number; 
                  agents_deleted: number; 
                  batches_processed: number;
                }>();

              if (finalLog) {
                await logger.completeLog(message.logId, 'success', {
                  agentsIndexed: finalLog.agents_indexed,
                  agentsDeleted: finalLog.agents_deleted,
                  batchesProcessed: finalLog.batches_processed,
                });
                console.log(`[queue] ✅ Marked sync log ${message.logId} as success - all chains completed`);
              }
            }
          }

          // Get updated totals for logging
          const updatedLog = await env.DB.prepare(
            'SELECT agents_indexed, agents_deleted, batches_processed, status FROM sync_logs WHERE id = ?'
          )
            .bind(message.logId)
            .first<{ 
              agents_indexed: number; 
              agents_deleted: number; 
              batches_processed: number;
              status: string;
            }>();

          console.log(`[queue] Updated sync log ${message.logId} for chain ${chainId}`, {
            chainStats: { agentsIndexed, agentsDeleted, batchesProcessed },
            totalStats: updatedLog ? {
              agentsIndexed: updatedLog.agents_indexed,
              agentsDeleted: updatedLog.agents_deleted,
              batchesProcessed: updatedLog.batches_processed,
            } : null,
            isExpectedChain,
            syncError: syncError || null,
            logStatus: updatedLog?.status,
          });
        } else {
          console.warn(`[queue] Sync log ${message.logId} not found, cannot update stats`);
        }
      } catch (logError) {
        console.error(`[queue] Failed to update sync log ${message.logId}:`, logError);
        // Don't throw - logging failure shouldn't fail the sync
      }
    }
  }
}
