import type { D1Database } from '@cloudflare/workers-types';
import { SDK } from 'agent0-sdk';
import { SemanticSyncRunner, type SemanticSyncRunnerOptions } from '../utils/semantic-sync-runner.js';
import { D1SemanticSyncStateStoreV2 } from '../utils/d1-sync-state-store-v2.js';
import { getChains, initializeDefaults } from '../utils/config-store.js';
import { VeniceEmbeddingProvider } from '../utils/providers/venice-embedding.js';
import { PineconeVectorStore } from '../utils/providers/pinecone-vector-store.js';

export interface IndexingServiceConfig {
  db: D1Database;
  rpcUrl: string;
  veniceApiKey: string;
  pineconeApiKey: string;
  pineconeIndex: string;
  pineconeNamespace?: string;
  veniceModel?: string;
  batchSize?: number;
}

export interface SyncStats {
  agentsIndexed: number;
  agentsDeleted: number;
  batchesProcessed: number;
}

/**
 * Indexing service that syncs ERC8004 registry agents to semantic search index
 */
export class IndexingService {
  private readonly config: IndexingServiceConfig;

  constructor(config: IndexingServiceConfig) {
    this.config = config;
  }

  /**
   * Perform indexing sync for all configured chains
   * Returns statistics about the sync operation
   */
  async sync(): Promise<SyncStats> {
    // Initialize default config if needed
    await initializeDefaults(this.config.db);

    // Get configured chains
    const chains = await getChains(this.config.db);

    if (chains.length === 0) {
      console.warn('No chains configured for indexing');
      return {
        agentsIndexed: 0,
        agentsDeleted: 0,
        batchesProcessed: 0,
      };
    }

    console.log(`Starting indexing sync for chains: ${chains.join(', ')}`);

    // Track statistics
    let agentsIndexed = 0;
    let agentsDeleted = 0;
    let batchesProcessed = 0;

    // Create D1 sync state store
    const stateStore = new D1SemanticSyncStateStoreV2(this.config.db);

    // Create our own provider instances to avoid AJV issues with SDK's Pinecone initialization
    const embeddingProvider = new VeniceEmbeddingProvider({
      apiKey: this.config.veniceApiKey,
      model: this.config.veniceModel || 'text-embedding-bge-m3',
    });

    // Create Pinecone vector store
    const vectorStoreProvider = new PineconeVectorStore({
      apiKey: this.config.pineconeApiKey,
      index: this.config.pineconeIndex,
      namespace: this.config.pineconeNamespace,
    });

    // Initialize Pinecone connection before starting sync
    try {
      console.log(`[indexing] Initializing Pinecone connection to index: ${this.config.pineconeIndex}`);
      const initStart = Date.now();
      await vectorStoreProvider.initialize();
      const initDuration = Date.now() - initStart;
      console.log(`[indexing] Pinecone connection initialized successfully (${initDuration}ms)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('[indexing] Failed to initialize Pinecone connection:', {
        error: errorMessage,
        stack: errorStack,
        index: this.config.pineconeIndex,
        hasApiKey: !!this.config.pineconeApiKey,
      });
      throw new Error(`Pinecone initialization failed: ${errorMessage}. Please check your PINECONE_API_KEY and PINECONE_INDEX configuration.`);
    }

    // Initialize SDK (optional, mainly for subgraph URL resolution if needed)
    const primaryChainId = chains[0];
    const sdk = new SDK({
      chainId: primaryChainId,
      rpcUrl: this.config.rpcUrl,
    });

    // Create sync runner with configured chains as targets
    const targets = chains.map((chainId) => ({ chainId }));
    const options: SemanticSyncRunnerOptions = {
      batchSize: this.config.batchSize || 50,
      stateStore,
      embeddingProvider,
      vectorStoreProvider,
      logger: (event: string, extra?: Record<string, unknown>) => {
        console.log(`[indexing] ${event}`, extra ?? {});
        
        // Track statistics from log events
        if (event === 'semantic-sync:batch-processed' && extra) {
          batchesProcessed++;
          if (typeof extra.indexed === 'number') {
            agentsIndexed += extra.indexed;
          }
          if (typeof extra.deleted === 'number') {
            agentsDeleted += extra.deleted;
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

    // Run the sync
    await runner.run();

    console.log('Indexing sync completed', {
      agentsIndexed,
      agentsDeleted,
      batchesProcessed,
    });

    return {
      agentsIndexed,
      agentsDeleted,
      batchesProcessed,
    };
  }
}

