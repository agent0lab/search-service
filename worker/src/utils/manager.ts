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

    if (this.embeddingProvider.generateBatchEmbeddings) {
      embeddings = await this.embeddingProvider.generateBatchEmbeddings(texts);
    } else {
      embeddings = [];
      for (const text of texts) {
        embeddings.push(await this.embeddingProvider.generateEmbedding(text));
      }
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
    providerVersion: string
  ): Promise<StandardSearchResponse> {
    await this.ensureInitialized();
    const { query, limit = 10, offset, cursor, filters, minScore, includeMetadata = true } = request;

    // Transform standard filters to Pinecone format
    let pineconeFilters;
    let postFilter: ((metadata: Record<string, unknown>) => boolean) | undefined;
    
    if (filters) {
      // Apply field mapping
      const mappedFilters = applyFieldMapping(filters);
      
      // Transform to Pinecone format
      const { pineconeFilter, requiresPostFilter, postFilter: pf } = transformStandardFiltersToPinecone(mappedFilters);
      pineconeFilters = pineconeFilter;
      postFilter = pf;
    }

    // Get effective offset (cursor takes precedence)
    const effectiveOffset = getOffset(cursor, offset);

    // Query with a higher topK to account for pagination and post-filtering
    // We need to fetch enough results to cover: offset + limit (with buffer for filtering)
    // The 3x multiplier accounts for potential filtering reduction
    // Capped at 100 (Pinecone's typical max, though this may vary by provider)
    const queryTopK = Math.min(effectiveOffset + limit * 3, 100);

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
}

