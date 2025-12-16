import type { AgentId, ChainId } from './types.js';
import type {
  SemanticAgentRecord,
  SemanticSearchResponse,
  SemanticSearchResult,
} from './types.js';
import type {
  EmbeddingProvider,
  SemanticQueryRequest,
  VectorStoreProvider,
  VectorUpsertItem,
} from './interfaces.js';
import type {
  StandardSearchRequest,
  StandardSearchResponse,
  StandardSearchResult,
  StandardMetadata,
} from './standard-types.js';
import { transformStandardFiltersToPinecone, applyFieldMapping } from './filter-transformer.js';
import { getOffset, paginateResults, calculateCursorPagination, encodeCursor } from './pagination.js';
import { MAX_TOP_K } from '../types.js';

export class SemanticSearchManager {
  private initialized = false;

  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly vectorStore: VectorStoreProvider
  ) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.embeddingProvider.initialize) {
      await this.embeddingProvider.initialize();
    }

    if (this.vectorStore.initialize) {
      await this.vectorStore.initialize();
    }

    this.initialized = true;
  }

  static formatVectorId(chainId: ChainId, agentId: AgentId): string {
    return `${chainId}-${agentId}`;
  }

  static parseVectorId(vectorId: string): { chainId: ChainId; agentId: AgentId } {
    const separatorIndex = vectorId.indexOf('-');
    if (separatorIndex === -1) {
      throw new Error(`Invalid vector ID format: ${vectorId}`);
    }

    const chainIdPart = vectorId.slice(0, separatorIndex);
    const agentIdPart = vectorId.slice(separatorIndex + 1);
    const parsedChainId = Number(chainIdPart);

    if (Number.isNaN(parsedChainId)) {
      throw new Error(`Invalid chain ID in vector ID: ${vectorId}`);
    }

    return {
      chainId: parsedChainId as ChainId,
      agentId: agentIdPart as AgentId,
    };
  }

  async indexAgent(agent: SemanticAgentRecord): Promise<void> {
    await this.ensureInitialized();
    const text = this.embeddingProvider.prepareAgentText(agent);
    const embedding = await this.embeddingProvider.generateEmbedding(text);
    const item = this.buildVectorUpsertItem(agent, embedding);
    await this.vectorStore.upsert(item);
  }

  async indexAgentsBatch(agents: SemanticAgentRecord[]): Promise<void> {
    await this.ensureInitialized();
    if (agents.length === 0) {
      return;
    }

    const texts = agents.map(agent => this.embeddingProvider.prepareAgentText(agent));
    let embeddings: number[][];

    try {
      if (this.embeddingProvider.generateBatchEmbeddings) {
        embeddings = await this.embeddingProvider.generateBatchEmbeddings(texts);
      } else {
        embeddings = [];
        for (const text of texts) {
          embeddings.push(await this.embeddingProvider.generateEmbedding(text));
        }
      }
    } catch (error) {
      // If batch embedding fails (e.g., token limit exceeded), fall back to individual processing
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('token') || errorMessage.includes('8192')) {
        console.warn(`Batch embedding failed (likely token limit), falling back to individual processing for ${agents.length} agents`);
        // Process agents individually
        for (const agent of agents) {
          try {
            await this.indexAgent(agent);
          } catch (individualError) {
            console.error(`Failed to index agent ${agent.agentId}:`, individualError);
            // Continue with other agents even if one fails
          }
        }
        return;
      }
      // Re-throw if it's not a token limit error
      throw error;
    }

    const items = agents.map((agent, index) => this.buildVectorUpsertItem(agent, embeddings[index]));

    if (this.vectorStore.upsertBatch) {
      await this.vectorStore.upsertBatch(items);
      return;
    }

    for (const item of items) {
      await this.vectorStore.upsert(item);
    }
  }

  async updateAgent(agent: SemanticAgentRecord): Promise<void> {
    await this.indexAgent(agent);
  }

  async deleteAgent(chainId: ChainId, agentId: AgentId): Promise<void> {
    await this.ensureInitialized();
    const vectorId = SemanticSearchManager.formatVectorId(chainId, agentId);
    await this.vectorStore.delete(vectorId);
  }

  async deleteAgentsBatch(pairs: Array<{ chainId: ChainId; agentId: AgentId }>): Promise<void> {
    await this.ensureInitialized();
    if (pairs.length === 0) {
      return;
    }

    const vectorIds = pairs.map(({ chainId, agentId }) => SemanticSearchManager.formatVectorId(chainId, agentId));

    if (this.vectorStore.deleteMany) {
      await this.vectorStore.deleteMany(vectorIds);
      return;
    }

    for (const vectorId of vectorIds) {
      await this.vectorStore.delete(vectorId);
    }
  }

  async searchAgents(request: SemanticQueryRequest): Promise<SemanticSearchResponse> {
    await this.ensureInitialized();
    const { query, topK, filters, minScore } = request;
    const embedding = await this.embeddingProvider.generateEmbedding(query);

    const matches = await this.vectorStore.query({
      vector: embedding,
      topK,
      filter: filters,
    });

    let filteredMatches = matches;
    if (typeof minScore === 'number') {
      filteredMatches = matches.filter(match => (match.score ?? 0) >= minScore);
    }

    const results: SemanticSearchResult[] = filteredMatches.map((match, index) => {
      const { chainId, agentId } = SemanticSearchManager.parseVectorId(match.id);
      const metadata = match.metadata || {};
      const name = typeof metadata.name === 'string' ? metadata.name : undefined;
      const description = typeof metadata.description === 'string' ? metadata.description : undefined;

      return {
        rank: index + 1,
        vectorId: match.id,
        agentId,
        chainId,
        name,
        description,
        score: match.score,
        metadata,
        matchReasons: match.matchReasons,
      };
    });

    return {
      query,
      results,
      total: results.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Search agents using the standard v1 API format
   * Supports standard filter operators, pagination, and metadata filtering
   */
  async searchAgentsV1(
    request: StandardSearchRequest,
    providerName: string,
    providerVersion: string,
    getConfiguredChains?: () => Promise<number[]>
  ): Promise<StandardSearchResponse> {
    await this.ensureInitialized();
    const { query, limit = 10, offset, cursor, filters, minScore, includeMetadata = true, name, chains, sort } = request;

    // Handle chains parameter - merge into filters
    let mergedFilters = filters ? { ...filters } : {};
    if (chains) {
      if (!mergedFilters.in) {
        mergedFilters.in = {};
      }
      
      if (chains === 'all') {
        // Get all configured chains
        if (getConfiguredChains) {
          const allChains = await getConfiguredChains();
          mergedFilters.in.chainId = allChains;
        } else {
          // Fallback: use common chains if getConfiguredChains not provided
          mergedFilters.in.chainId = [11155111, 84532, 80002];
        }
      } else if (Array.isArray(chains) && chains.length > 0) {
        if (chains.length === 1) {
          // Single chain - use equals instead of in
          if (!mergedFilters.equals) {
            mergedFilters.equals = {};
          }
          mergedFilters.equals.chainId = chains[0];
        } else {
          // Multiple chains - use in
          mergedFilters.in.chainId = chains;
        }
      }
    }

    // Transform standard filters to Pinecone format
    let pineconeFilters;
    let postFilter: ((metadata: Record<string, unknown>) => boolean) | undefined;
    
    if (Object.keys(mergedFilters).length > 0) {
      // Apply field mapping
      const mappedFilters = applyFieldMapping(mergedFilters);
      
      // Transform to Pinecone format
      const { pineconeFilter, requiresPostFilter, postFilter: pf } = transformStandardFiltersToPinecone(mappedFilters);
      pineconeFilters = pineconeFilter;
      postFilter = pf;
    }

    // Get effective offset (cursor takes precedence)
    const effectiveOffset = getOffset(cursor, offset);

    // Optimize multiplier based on filtering needs
    // If we have post-filtering (exists/notExists) or minScore, we need a larger buffer
    // because these filters reduce the result set after fetching from Pinecone
    // Otherwise, we can use a smaller multiplier (2x instead of 3x) for better efficiency
    const hasPostFiltering = !!postFilter || typeof minScore === 'number';
    const filterMultiplier = hasPostFiltering ? 3 : 2;
    
    // Calculate required topK: offset + limit * multiplier
    // This ensures we fetch enough results to cover the offset and requested limit,
    // with a buffer to account for post-filtering that may reduce results
    const requiredTopK = effectiveOffset + limit * filterMultiplier;
    
    // Cap at MAX_TOP_K (100) to respect Pinecone's maximum topK limit
    // If requiredTopK exceeds MAX_TOP_K, we can't fetch enough results
    // This should be caught by validation middleware, but we handle it gracefully here too
    const queryTopK = Math.min(requiredTopK, MAX_TOP_K);
    
    // Early return if offset is too large (should be caught by validation, but defensive check)
    if (effectiveOffset >= MAX_TOP_K) {
      return {
        query,
        results: [],
        total: 0,
        pagination: {
          hasMore: false,
          limit,
          offset: effectiveOffset,
        },
        requestId: '', // Will be set by handler
        timestamp: new Date().toISOString(),
        provider: {
          name: providerName,
          version: providerVersion,
        },
      };
    }

    const embedding = await this.embeddingProvider.generateEmbedding(query);
    const matches = await this.vectorStore.query({
      vector: embedding,
      topK: queryTopK,
      filter: pineconeFilters,
    });

    // Apply minScore filtering
    let filteredMatches = matches;
    if (typeof minScore === 'number') {
      filteredMatches = matches.filter(match => (match.score ?? 0) >= minScore);
    }

    // Apply post-filtering for exists/notExists operators
    if (postFilter) {
      filteredMatches = filteredMatches.filter(match => {
        const metadata = match.metadata || {};
        return postFilter!(metadata);
      });
    }

    // Apply name substring filtering (post-filter)
    if (name && typeof name === 'string' && name.trim() !== '') {
      const nameLower = name.toLowerCase().trim();
      filteredMatches = filteredMatches.filter(match => {
        const metadata = match.metadata || {};
        const agentName = typeof metadata.name === 'string' ? metadata.name : '';
        return agentName.toLowerCase().includes(nameLower);
      });
    }

    // Apply sorting if specified
    if (sort && Array.isArray(sort) && sort.length > 0) {
      filteredMatches = this.applySorting(filteredMatches, sort);
    }

    // Validate that we have enough results for the requested offset
    // If offset is beyond available results, return empty (this is expected behavior)
    if (effectiveOffset >= filteredMatches.length) {
      // Return empty results with correct pagination metadata
      const pagination = cursor
        ? calculateCursorPagination(limit, cursor, filteredMatches.length, 0)
        : {
            hasMore: false,
            limit,
            offset: effectiveOffset,
          };

      return {
        query,
        results: [],
        total: filteredMatches.length,
        pagination,
        requestId: '', // Will be set by handler
        timestamp: new Date().toISOString(),
        provider: {
          name: providerName,
          version: providerVersion,
        },
      };
    }

    // Apply pagination
    const paginatedMatches = paginateResults(filteredMatches, effectiveOffset, limit);

    // Build results
    const results: StandardSearchResult[] = paginatedMatches.map((match, index) => {
      const { chainId, agentId } = SemanticSearchManager.parseVectorId(match.id);
      const metadata = match.metadata || {};
      const name = typeof metadata.name === 'string' ? metadata.name : '';
      const description = typeof metadata.description === 'string' ? metadata.description : '';

      // Build standard metadata (only if includeMetadata is true)
      let standardMetadata: StandardMetadata | undefined;
      if (includeMetadata) {
        standardMetadata = {
          ...metadata,
          agentId,
          chainId,
          name,
          description,
        } as StandardMetadata;
      }

      return {
        rank: effectiveOffset + index + 1,
        vectorId: match.id,
        agentId,
        chainId,
        name,
        description,
        score: match.score ?? 0,
        metadata: standardMetadata,
        matchReasons: match.matchReasons,
      };
    });

    // Calculate pagination metadata
    const totalResults = filteredMatches.length; // Approximate total
    let pagination;
    
    if (cursor) {
      pagination = calculateCursorPagination(limit, cursor, totalResults, results.length);
    } else {
      const hasMore = effectiveOffset + results.length < totalResults;
      const nextOffset = effectiveOffset + results.length;
      pagination = {
        hasMore,
        nextCursor: hasMore ? encodeCursor({ offset: nextOffset }) : undefined,
        limit,
        offset: effectiveOffset,
      };
    }

    return {
      query,
      results,
      total: totalResults,
      pagination,
      requestId: '', // Will be set by handler
      timestamp: new Date().toISOString(),
      provider: {
        name: providerName,
        version: providerVersion,
      },
    };
  }

  private buildVectorUpsertItem(agent: SemanticAgentRecord, embedding: number[]): VectorUpsertItem {
    const vectorId = SemanticSearchManager.formatVectorId(agent.chainId, agent.agentId);

    const metadata: Record<string, unknown> = {
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities || [],
      defaultInputModes: agent.defaultInputModes || [],
      defaultOutputModes: agent.defaultOutputModes || [],
      tags: agent.tags || [],
      chainId: agent.chainId,
      agentId: agent.agentId,
      updatedAt: new Date().toISOString(),
      ...(agent.metadata || {}),
    };

    return {
      id: vectorId,
      values: embedding,
      metadata,
    };
  }

  /**
   * Apply sorting to search results
   * Sort strings format: "field:direction" (e.g., "updatedAt:desc", "name:asc")
   */
  private applySorting(
    matches: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }>,
    sort: string[]
  ): Array<{ id: string; score?: number; metadata?: Record<string, unknown> }> {
    const sorted = [...matches];

    sorted.sort((a, b) => {
      for (const sortSpec of sort) {
        const [field, direction = 'asc'] = sortSpec.split(':');
        const dir = direction.toLowerCase() === 'desc' ? -1 : 1;

        let aValue: unknown;
        let bValue: unknown;

        if (field === 'score') {
          aValue = a.score ?? 0;
          bValue = b.score ?? 0;
        } else {
          aValue = a.metadata?.[field];
          bValue = b.metadata?.[field];
        }

        // Handle undefined/null values
        if (aValue === undefined || aValue === null) {
          if (bValue === undefined || bValue === null) {
            continue; // Both undefined, try next sort field
          }
          return dir; // a is undefined, b is not
        }
        if (bValue === undefined || bValue === null) {
          return -dir; // b is undefined, a is not
        }

        // Compare values
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
          comparison = aValue === bValue ? 0 : aValue ? 1 : -1;
        } else {
          // Fallback: convert to string
          comparison = String(aValue).localeCompare(String(bValue));
        }

        if (comparison !== 0) {
          return comparison * dir;
        }
      }
      return 0; // All sort fields equal
    });

    return sorted;
  }
}

