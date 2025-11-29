import type { Context } from 'hono';
import type { Env } from '../types.js';
import type { SemanticQueryRequest } from '../utils/interfaces.js';
import type { SemanticSearchResponse } from '../utils/types.js';
import { SemanticSearchManager } from '../utils/manager.js';
import { resolveSemanticSearchProviders } from '../utils/config.js';
import { VeniceEmbeddingProvider } from '../utils/providers/venice-embedding.js';
import { PineconeVectorStore } from '../utils/providers/pinecone-vector-store.js';

export async function searchHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    // Parse request body
    const body = await c.req.json<SemanticQueryRequest>();
    
    // Validate required fields
    if (!body.query || typeof body.query !== 'string') {
      return c.json({ error: 'Missing or invalid query parameter' }, 400);
    }

    // Initialize providers from environment
    const providers = resolveSemanticSearchProviders({
      embedding: {
        provider: 'venice',
        apiKey: c.env.VENICE_API_KEY,
      },
      vectorStore: {
        provider: 'pinecone',
        apiKey: c.env.PINECONE_API_KEY,
        index: c.env.PINECONE_INDEX,
        namespace: c.env.PINECONE_NAMESPACE,
      },
    });

    // Create search manager
    const manager = new SemanticSearchManager(providers.embedding, providers.vectorStore);

    // Perform search
    const response: SemanticSearchResponse = await manager.searchAgents({
      query: body.query,
      topK: body.topK,
      filters: body.filters,
      minScore: body.minScore,
    });

    return c.json(response);
  } catch (error) {
    console.error('Search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
}

