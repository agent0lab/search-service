import type { SDK } from 'agent0-sdk';
import type { SemanticAgentRecord } from './types.js';
import type { EmbeddingProvider, VectorStoreProvider } from './interfaces.js';
import { computeAgentHash } from './sync-state.js';
import { SemanticSearchManager } from './manager.js';
import { getDefaultSubgraphEndpoints } from './subgraph-config.js';

/**
 * Batch-oriented sync state store interface (normalized hashes).
 */
export interface SemanticSyncStateStoreV2 {
  getLastUpdatedAt(chainId: string): Promise<string>;
  setLastUpdatedAt(chainId: string, lastUpdatedAt: string): Promise<void>;
  getAgentHashes(chainId: string, agentIds: string[]): Promise<Record<string, string>>;
  upsertAgentHashes(chainId: string, hashes: Record<string, string>, nowIso?: string): Promise<void>;
  deleteAgentHashes(chainId: string, agentIds: string[]): Promise<void>;
  migrateLegacyAgentHashesBlobToTable?(
    chainId: string,
    chunkSize?: number
  ): Promise<{ migrated: boolean; count: number }>;
}

export interface SemanticSyncTarget {
  chainId: number;
  subgraphUrl?: string;
}

export interface SemanticSyncRunnerOptions {
  batchSize?: number;
  stateStore: SemanticSyncStateStoreV2;
  embeddingProvider: EmbeddingProvider;
  vectorStoreProvider: VectorStoreProvider;
  logger?: (event: string, extra?: Record<string, unknown>) => void;
  targets: SemanticSyncTarget[];
}

interface SubgraphAgent {
  id: string;
  chainId: string;
  agentId: string;
  owner?: string | null;
  operators?: string[] | null;
  updatedAt: string;
  createdAt?: string | null;
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
    mcpEndpoint?: string | null;
    mcpVersion?: string | null;
    a2aEndpoint?: string | null;
    a2aVersion?: string | null;
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

    const chainKey = String(chainId);

    // One-time backfill from legacy per-chain JSON blob (if present)
    if (typeof this.options.stateStore.migrateLegacyAgentHashesBlobToTable === 'function') {
      const { migrated, count } = await this.options.stateStore.migrateLegacyAgentHashesBlobToTable(chainKey);
      if (migrated) {
        logger?.('semantic-sync:legacy-hashes-migrated', { chainId, count });
      }
    }

    let lastUpdatedAt = await this.options.stateStore.getLastUpdatedAt(chainKey);
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

      // Track max updatedAt in this page so we can advance cursor even if nothing changes.
      let maxUpdatedAt = lastUpdatedAt;

      // Partition agents (orphan deletes vs index candidates)
      const toDelete: Array<{ chainId: number; agentId: string }> = [];
      const deleteAgentIds: string[] = [];
      const indexCandidates: Array<{ agentId: string; record: SemanticAgentRecord; hash: string }> = [];

      for (const agent of agents) {
        const updatedAt = agent.updatedAt || '0';
        if (updatedAt > maxUpdatedAt) {
          maxUpdatedAt = updatedAt;
        }

        const agentId = agent.id;
        const agentChainId = Number(agent.chainId);

        // Orphan: no registration file -> delete from vector store and remove hash
        if (!agent.registrationFile) {
          toDelete.push({ chainId: agentChainId, agentId });
          deleteAgentIds.push(agentId);
          continue;
        }

        const record = this.convertToSemanticAgentRecord(agent);
        const hash = computeAgentHash(record);
        indexCandidates.push({ agentId, record, hash });
      }

      // Fetch previous hashes only for this page's agent IDs
      const candidateIds = indexCandidates.map(c => c.agentId);
      const existingHashes = await this.options.stateStore.getAgentHashes(chainKey, candidateIds);

      // Decide which agents actually changed
      const toIndex: SemanticAgentRecord[] = [];
      const upsertHashes: Record<string, string> = {};
      for (const candidate of indexCandidates) {
        if (existingHashes[candidate.agentId] === candidate.hash) {
          continue;
        }
        toIndex.push(candidate.record);
        upsertHashes[candidate.agentId] = candidate.hash;
      }
      
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

      // Persist hash updates/deletes after successful vector writes
      if (Object.keys(upsertHashes).length > 0) {
        await this.options.stateStore.upsertAgentHashes(chainKey, upsertHashes);
      }
      if (deleteAgentIds.length > 0) {
        await this.options.stateStore.deleteAgentHashes(chainKey, deleteAgentIds);
      }

      // Persist cursor after successful processing of this page
      lastUpdatedAt = maxUpdatedAt;
      await this.options.stateStore.setLastUpdatedAt(chainKey, lastUpdatedAt);
      
      logger?.('semantic-sync:batch-processed', {
        chainId,
        indexed: toIndex.length,
        deleted: toDelete.length,
        lastUpdatedAt,
        agentIds: toIndex.map(r => r.agentId),
        agentIdsDeleted: deleteAgentIds,
      });
    }

    logger?.('semantic-sync:chain-complete', {
      chainId,
      indexed: totalIndexed,
      deleted: totalDeleted,
      lastUpdatedAt,
    });
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
      // Fallback: default subgraph URLs (centralized in search-service/subgraph-endpoints.json)
      const defaults = getDefaultSubgraphEndpoints();
      url = defaults[chainId];
      
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
          owner
          operators
          updatedAt
          createdAt
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
            mcpEndpoint
            mcpVersion
            a2aEndpoint
            a2aVersion
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

    const supportedTrusts = normalizeStringArray(reg.supportedTrusts);
    const mcpTools = normalizeStringArray(reg.mcpTools);
    const mcpPrompts = normalizeStringArray(reg.mcpPrompts);
    const mcpResources = normalizeStringArray(reg.mcpResources);
    const a2aSkills = normalizeStringArray(reg.a2aSkills);
    const operators = normalizeStringArray(agent.operators);
    
    // Derive boolean fields from endpoint existence
    const hasMcpEndpoint = !!(reg.mcpEndpoint && reg.mcpEndpoint.trim() !== '');
    const hasA2aEndpoint = !!(reg.a2aEndpoint && reg.a2aEndpoint.trim() !== '');
    
    const metadata: Record<string, unknown> = {
      registrationId: reg.id ?? undefined,
      image: reg.image ?? undefined,
      supportedTrusts: supportedTrusts ?? undefined,
      mcpTools: mcpTools ?? undefined,
      mcpPrompts: mcpPrompts ?? undefined,
      mcpResources: mcpResources ?? undefined,
      a2aSkills: a2aSkills ?? undefined,
      ens: reg.ens ?? undefined,
      did: reg.did ?? undefined,
      agentWallet: reg.agentWallet ?? undefined,
      active: reg.active ?? undefined,
      x402support: reg.x402support ?? undefined,
      mcpEndpoint: reg.mcpEndpoint ?? undefined,
      mcpVersion: reg.mcpVersion ?? undefined,
      a2aEndpoint: reg.a2aEndpoint ?? undefined,
      a2aVersion: reg.a2aVersion ?? undefined,
      owner: agent.owner ?? undefined,
      operators: operators ?? undefined,
      createdAt: agent.createdAt ?? undefined,
      updatedAt: agent.updatedAt,
      // Derived boolean fields for native Pinecone filtering
      mcp: hasMcpEndpoint,
      a2a: hasA2aEndpoint,
    };

    const capabilities = normalizeStringArray([
      ...(mcpTools ?? []),
      ...(mcpPrompts ?? []),
      ...(a2aSkills ?? []),
    ]);
    
    return {
      chainId,
      agentId: agent.id, // Format: "chainId:tokenId"
      name: reg.name ?? '',
      description: reg.description ?? '',
      capabilities: capabilities ?? [],
      defaultInputModes: mcpTools && mcpTools.length > 0 ? ['mcp'] : ['text'],
      defaultOutputModes: ['json'],
      tags: supportedTrusts ?? [],
      metadata,
    };
  }
}

function normalizeStringArray(values?: Array<string | null> | null): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  const cleaned = values
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(v => v.length > 0);
  if (cleaned.length === 0) {
    return undefined;
  }
  // Treat as set: de-dupe + sort for deterministic behavior.
  return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
}

