import type { MessageBatch } from '@cloudflare/workers-types';
import type { Env, ChainSyncMessage } from './types.js';
import { SDK } from 'agent0-ts/index.js';
import { SemanticSyncRunner, type SemanticSyncRunnerOptions } from 'agent0-ts/semantic-search/index.js';
import { PineconeVectorStore } from './utils/providers/pinecone-vector-store.js';
import { VeniceEmbeddingProvider } from './utils/providers/venice-embedding.js';
import { D1SemanticSyncStateStore } from './utils/d1-sync-state-store.js';
import { SyncLockManager } from './utils/sync-lock.js';

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
  const otherMessages: typeof batch.messages = [];

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
  
  console.log(`[queue] Starting chain sync for chain ${chainId} (batch size: ${batchSize})`);

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

  try {
    // Create sync state store
    const stateStore = new D1SemanticSyncStateStore(env.DB);

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

    // Initialize SDK with the chain
    const sdk = new SDK({
      chainId,
      rpcUrl: env.RPC_URL,
      semanticSearch: {
        embedding: embeddingProvider,
        vectorStore: pineconeStore,
      },
    });

    // Create sync runner for this chain
    const targets = message.subgraphUrl
      ? [{ chainId, subgraphUrl: message.subgraphUrl }]
      : [{ chainId }];
      
    const options: SemanticSyncRunnerOptions = {
      batchSize,
      stateStore,
      logger: (event: string, extra?: Record<string, unknown>) => {
        console.log(`[queue:chain-${chainId}] ${event}`, extra ?? {});
      },
      targets,
    };

    const runner = new SemanticSyncRunner(sdk, options);

    // Run the full sync for this chain
    console.log(`[queue] Running full sync for chain ${chainId}...`);
    const startTime = Date.now();
    
    await runner.run();
    
    const duration = Date.now() - startTime;
    console.log(`[queue] Chain sync completed for chain ${chainId} (duration: ${duration}ms)`);
  } finally {
    // Always release the lock, even if sync failed
    await lockManager.releaseLock(chainIdStr);
    console.log(`[queue] Released lock for chain ${chainId}`);
  }
}
