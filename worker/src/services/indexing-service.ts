import type { D1Database } from '@cloudflare/workers-types';
import { SDK } from 'agent0-sdk';
import { SemanticSyncRunner, type SemanticSyncRunnerOptions } from 'agent0-sdk';
import { D1SemanticSyncStateStore } from '../utils/d1-sync-state-store.js';
import { getChains, initializeDefaults } from '../utils/config-store.js';

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
   */
  async sync(): Promise<void> {
    // Initialize default config if needed
    await initializeDefaults(this.config.db);

    // Get configured chains
    const chains = await getChains(this.config.db);

    if (chains.length === 0) {
      console.warn('No chains configured for indexing');
      return;
    }

    console.log(`Starting indexing sync for chains: ${chains.join(', ')}`);

    // Create D1 sync state store
    const stateStore = new D1SemanticSyncStateStore(this.config.db);

    // Initialize SDK with first chain (for subgraph client initialization)
    // The SemanticSyncRunner will handle multiple chains via targets
    const primaryChainId = chains[0];
    const sdk = new SDK({
      chainId: primaryChainId,
      rpcUrl: this.config.rpcUrl,
      semanticSearch: {
        embedding: {
          provider: 'venice',
          apiKey: this.config.veniceApiKey,
          model: this.config.veniceModel || 'text-embedding-bge-m3',
        },
        vectorStore: {
          provider: 'pinecone',
          apiKey: this.config.pineconeApiKey,
          index: this.config.pineconeIndex,
          namespace: this.config.pineconeNamespace,
        },
      },
    });

    // Create sync runner with configured chains as targets
    const targets = chains.map((chainId) => ({ chainId }));
    const options: SemanticSyncRunnerOptions = {
      batchSize: this.config.batchSize || 50,
      stateStore,
      logger: (event, extra) => {
        console.log(`[indexing] ${event}`, extra ?? {});
      },
      targets,
    };

    const runner = new SemanticSyncRunner(sdk, options);

    // Run the sync
    await runner.run();

    console.log('Indexing sync completed');
  }
}

