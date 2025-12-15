import type { SDK } from 'agent0-sdk';
import type { SemanticAgentRecord } from './types.js';
import type {
  SemanticSyncState,
  SemanticSyncStateStore,
  ChainSyncState,
} from './sync-state.js';
import type { EmbeddingProvider, VectorStoreProvider } from './interfaces.js';
import { normalizeSemanticSyncState, computeAgentHash } from './sync-state.js';
import { SemanticSearchManager } from './manager.js';

export interface SemanticSyncTarget {
  chainId: number;
  subgraphUrl?: string;
}

export interface SemanticSyncRunnerOptions {
  batchSize?: number;
  stateStore: SemanticSyncStateStore;
  embeddingProvider: EmbeddingProvider;
  vectorStoreProvider: VectorStoreProvider;
  logger?: (event: string, extra?: Record<string, unknown>) => void;
  targets: SemanticSyncTarget[];
}

interface SubgraphAgent {
  id: string;
  chainId: string;
  agentId: string;
  updatedAt: string;
  registrationFile?: {
    id?: string | null;
    name?: string | null;
    description?: string | null;
    image?: string | null;
    active?: boolean | null;
    x402support?: boolean | null;
    supportedTrusts?: string[] | null;
    mcpTools?: string[] | null;
    mcpPrompts?: string[] | null;
    mcpResources?: string[] | null;
    a2aSkills?: string[] | null;
    agentWallet?: string | null;
    ens?: string | null;
    did?: string | null;
  } | null;
}

/**
 * Local implementation of SemanticSyncRunner that uses:
 * - Official agent0-sdk for subgraph queries (optional, mainly for subgraph URL resolution)
 * - Local SemanticSearchManager for indexing
 * - Local state store for sync state management
 */
export class SemanticSyncRunner {
  private readonly sdk?: SDK;
  private readonly options: SemanticSyncRunnerOptions;
  private readonly searchManager: SemanticSearchManager;

  constructor(
    options: SemanticSyncRunnerOptions,
    sdk?: SDK
  ) {
    this.sdk = sdk;
    this.options = {
      batchSize: 50,
      ...options,
    };
    
    if (!options.embeddingProvider || !options.vectorStoreProvider) {
      throw new Error('SemanticSyncRunner requires embeddingProvider and vectorStoreProvider');
    }
    
    this.searchManager = new SemanticSearchManager(
      options.embeddingProvider,
      options.vectorStoreProvider
    );
  }

  async run(): Promise<void> {
    const { targets, logger } = this.options;
    
    logger?.('semantic-sync:start', { targets: targets.length });
    
    // Process each target chain
    for (const target of targets) {
      await this.processChain(target);
    }
    
    logger?.('semantic-sync:complete', { targets: targets.length });
  }

  private async processChain(target: SemanticSyncTarget): Promise<void> {
    const { chainId, subgraphUrl } = target;
    const { logger, batchSize = 50 } = this.options;
    
    logger?.('semantic-sync:chain-start', { chainId });
    
    // Load current state
    const rawState = await this.options.stateStore.load();
    const state = normalizeSemanticSyncState(rawState);
    const chainKey = String(chainId);
    const chainState = state.chains[chainKey] || {
      lastUpdatedAt: '0',
      agentHashes: {},
    };
    
    let lastUpdatedAt = chainState.lastUpdatedAt;
    let processedAny = false;
    let hasMore = true;
    let totalIndexed = 0;
    let totalDeleted = 0;
    
    // Process incrementally using updatedAt
    while (hasMore) {
      // Fetch agents updated after lastUpdatedAt
      const agents = await this.querySubgraphAgents(chainId, subgraphUrl, lastUpdatedAt, batchSize);
      
      if (agents.length === 0) {
        hasMore = false;
        break;
      }
      
      // Prepare agents for indexing/deletion
      const { toIndex, toDelete, hashes, maxUpdatedAt } = this.prepareAgents(agents, chainState);
      
      // Index new/changed agents
      if (toIndex.length > 0) {
        if (toIndex.length === 1) {
          await this.searchManager.indexAgent(toIndex[0]);
        } else {
          await this.searchManager.indexAgentsBatch(toIndex);
        }
        totalIndexed += toIndex.length;
      }
      
      // Delete orphaned agents (no registration file)
      if (toDelete.length > 0) {
        await this.searchManager.deleteAgentsBatch(toDelete);
        totalDeleted += toDelete.length;
      }
      
      // Update hashes after successful writes
      chainState.agentHashes = chainState.agentHashes || {};
      for (const { agentId, hash } of hashes) {
        if (hash) {
          chainState.agentHashes[agentId] = hash;
        } else {
          delete chainState.agentHashes[agentId];
        }
      }
      
      lastUpdatedAt = maxUpdatedAt;
      chainState.lastUpdatedAt = lastUpdatedAt;
      state.chains[chainKey] = chainState;
      
      // Save state after each batch
      await this.options.stateStore.save(state);
      processedAny = processedAny || toIndex.length > 0 || toDelete.length > 0;
      
      logger?.('semantic-sync:batch-processed', {
        chainId,
        indexed: toIndex.length,
        deleted: toDelete.length,
        lastUpdatedAt,
        agentIds: toIndex.map(r => r.agentId),
        agentIdsDeleted: toDelete.map(item => item.agentId),
      });
    }
    
    if (!processedAny) {
      logger?.('semantic-sync:no-op', { chainId, lastUpdatedAt });
    } else {
      logger?.('semantic-sync:chain-complete', {
        chainId,
        indexed: totalIndexed,
        deleted: totalDeleted,
        lastUpdatedAt,
      });
    }
  }
  
  private prepareAgents(
    agents: SubgraphAgent[],
    chainState: ChainSyncState
  ): {
    toIndex: SemanticAgentRecord[];
    toDelete: Array<{ chainId: number; agentId: string }>;
    hashes: Array<{ agentId: string; hash?: string }>;
    maxUpdatedAt: string;
  } {
    const toIndex: SemanticAgentRecord[] = [];
    const toDelete: Array<{ chainId: number; agentId: string }> = [];
    const hashes: Array<{ agentId: string; hash?: string }> = [];
    let maxUpdatedAt = chainState.lastUpdatedAt;
    
    for (const agent of agents) {
      const chainId = Number(agent.chainId);
      const agentId = agent.id;
      const updatedAt = agent.updatedAt || '0';
      
      if (updatedAt > maxUpdatedAt) {
        maxUpdatedAt = updatedAt;
      }
      
      // Handle orphaned agents (no registration file)
      if (!agent.registrationFile) {
        toDelete.push({ chainId, agentId });
        hashes.push({ agentId });
        continue;
      }
      
      const record = this.convertToSemanticAgentRecord(agent);
      const hash = computeAgentHash(record);
      
      // Only index if hash changed
      if (chainState.agentHashes?.[agentId] === hash) {
        continue;
      }
      
      toIndex.push(record);
      hashes.push({ agentId, hash });
    }
    
    return { toIndex, toDelete, hashes, maxUpdatedAt };
  }

  private async querySubgraphAgents(
    chainId: number,
    subgraphUrl: string | undefined,
    updatedAfter: string,
    first: number
  ): Promise<SubgraphAgent[]> {
    // Try to get subgraph URL from SDK if not provided
    let url = subgraphUrl;
    if (!url && this.sdk) {
      const sdkAny = this.sdk as any;
      // Try to get subgraph URL from SDK's subgraph client or config
      if (sdkAny.subgraphClient?.url) {
        url = sdkAny.subgraphClient.url;
      } else if (sdkAny.subgraphOverrides?.[chainId]) {
        url = sdkAny.subgraphOverrides[chainId];
      } else if (sdkAny.getSubgraphUrl) {
        url = await sdkAny.getSubgraphUrl(chainId);
      }
    }
    
    if (!url) {
      // Fallback: try to get default subgraph URL for chain
      // Common subgraph URLs for known chains (with API key in path)
      const defaultSubgraphs: Record<number, string> = {
        11155111: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT', // Ethereum Sepolia
        84532: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/GjQEDgEKqoh5Yc8MUgxoQoRATEJdEiH7HbocfR1aFiHa', // Base Sepolia
        80002: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/2A1JB18r1mF2VNP4QBH4mmxd74kbHoM6xLXC8ABAKf7j', // Polygon Amoy
      };
      
      url = defaultSubgraphs[chainId];
      
      if (!url) {
        throw new Error(`No subgraph URL available for chain ${chainId}. Please provide subgraphUrl in target.`);
      }
    }
    
    // Query subgraph incrementally using updatedAt
    const query = `
      query SemanticSyncAgents($updatedAfter: BigInt!, $first: Int!) {
        agents(
          where: { updatedAt_gt: $updatedAfter }
          orderBy: updatedAt
          orderDirection: asc
          first: $first
        ) {
          id
          chainId
          agentId
          updatedAt
          registrationFile {
            id
            name
            description
            image
            active
            x402support
            supportedTrusts
            mcpTools
            mcpPrompts
            mcpResources
            a2aSkills
            agentWallet
            ens
            did
          }
        }
      }
    `;
    
    const variables = {
      updatedAfter,
      first,
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    
    if (!response.ok) {
      throw new Error(`Subgraph query failed: ${response.statusText}`);
    }
    
    const result = await response.json() as {
      data?: { agents?: SubgraphAgent[] };
      errors?: Array<{ message: string }>;
    };
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(`Subgraph query errors: ${result.errors.map(e => e.message).join(', ')}`);
    }
    
    return result.data?.agents || [];
  }

  private convertToSemanticAgentRecord(agent: SubgraphAgent): SemanticAgentRecord {
    const chainId = Number(agent.chainId);
    const reg = agent.registrationFile!;
    
    const metadata: Record<string, unknown> = {
      registrationId: reg.id ?? undefined,
      image: reg.image ?? undefined,
      supportedTrusts: reg.supportedTrusts ?? undefined,
      mcpTools: reg.mcpTools ?? undefined,
      mcpPrompts: reg.mcpPrompts ?? undefined,
      mcpResources: reg.mcpResources ?? undefined,
      a2aSkills: reg.a2aSkills ?? undefined,
      ens: reg.ens ?? undefined,
      did: reg.did ?? undefined,
      agentWallet: reg.agentWallet ?? undefined,
      active: reg.active ?? undefined,
      x402support: reg.x402support ?? undefined,
      updatedAt: agent.updatedAt,
    };
    
    return {
      chainId,
      agentId: agent.id, // Format: "chainId:tokenId"
      name: reg.name ?? '',
      description: reg.description ?? '',
      capabilities: [
        ...(reg.mcpTools ?? []),
        ...(reg.mcpPrompts ?? []),
        ...(reg.a2aSkills ?? []),
      ],
      defaultInputModes: reg.mcpTools && reg.mcpTools.length > 0 ? ['mcp'] : ['text'],
      defaultOutputModes: ['json'],
      tags: reg.supportedTrusts ?? [],
      metadata,
    };
  }
}

