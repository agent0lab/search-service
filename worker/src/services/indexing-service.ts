import type { D1Database } from '@cloudflare/workers-types';
import { SDK } from 'agent0-ts/index.js';
import { SemanticSyncRunner, type SemanticSyncRunnerOptions } from 'agent0-ts/semantic-search/index.js';
import { D1SemanticSyncStateStore } from '../utils/d1-sync-state-store.js';
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
    const stateStore = new D1SemanticSyncStateStore(this.config.db);

    // Create our own provider instances to avoid AJV issues with SDK's Pinecone initialization
    const embeddingProvider = new VeniceEmbeddingProvider({
      apiKey: this.config.veniceApiKey,
      model: this.config.veniceModel || 'text-embedding-bge-m3',
    });

    const vectorStoreProvider = new PineconeVectorStore({
      apiKey: this.config.pineconeApiKey,
      index: this.config.pineconeIndex,
      namespace: this.config.pineconeNamespace,
    });

    // Initialize SDK with first chain (for subgraph client initialization)
    // The SemanticSyncRunner will handle multiple chains via targets
    // Pass provider instances directly to avoid SDK creating new ones
    const primaryChainId = chains[0];
    const sdk = new SDK({
      chainId: primaryChainId,
      rpcUrl: this.config.rpcUrl,
      semanticSearch: {
        embedding: embeddingProvider,
        vectorStore: vectorStoreProvider,
      },
    });

    // Create sync runner with configured chains as targets
    const targets = chains.map((chainId) => ({ chainId }));
    const options: SemanticSyncRunnerOptions = {
      batchSize: this.config.batchSize || 50,
      stateStore,
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
        }
      },
      targets,
    };

    const runner = new SemanticSyncRunner(sdk, options);

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

