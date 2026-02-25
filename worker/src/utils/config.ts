import type { EmbeddingProvider, SemanticSearchProviders, VectorStoreProvider } from './interfaces.js';
import { VeniceEmbeddingProvider, type VeniceEmbeddingConfig } from './providers/venice-embedding.js';
import { OpenAIEmbeddingProvider, type OpenAIEmbeddingConfig } from './providers/openai-embedding.js';
import { PineconeVectorStore, type PineconeVectorStoreConfig } from './providers/pinecone-vector-store.js';
import { PgVectorStore, type PgVectorStoreConfig } from './providers/pgvector-vector-store.js';

export type EmbeddingProviderDefinition =
  | EmbeddingProvider
  | ({ provider: 'venice' } & VeniceEmbeddingConfig)
  | ({ provider: 'openai' } & OpenAIEmbeddingConfig);

export type VectorStoreProviderDefinition =
  | VectorStoreProvider
  | ({ provider: 'pinecone' } & PineconeVectorStoreConfig)
  | ({ provider: 'pgvector' } & PgVectorStoreConfig);

export interface SemanticSearchConfig {
  embedding: EmbeddingProviderDefinition;
  vectorStore: VectorStoreProviderDefinition;
}

export interface SemanticProviderEnv {
  EMBEDDING_PROVIDER?: string;
  VECTOR_STORE_PROVIDER?: string;
  VENICE_API_KEY?: string;
  VENICE_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_EMBEDDING_MODEL?: string;
  OPENAI_EMBEDDING_BASE_URL?: string;
  OPENAI_EMBEDDING_API_VERSION?: string;
  PINECONE_API_KEY?: string;
  PINECONE_INDEX?: string;
  PINECONE_NAMESPACE?: string;
  PGVECTOR_DATABASE_URL?: string;
  PGVECTOR_TABLE?: string;
  PGVECTOR_DIMENSION?: string;
}

export function resolveSemanticSearchProviders(config: SemanticSearchConfig): SemanticSearchProviders {
  if (!config.embedding) {
    throw new Error('Semantic search configuration must include an embedding provider');
  }
  if (!config.vectorStore) {
    throw new Error('Semantic search configuration must include a vector store provider');
  }

  const embedding = resolveEmbeddingProvider(config.embedding);
  const vectorStore = resolveVectorStoreProvider(config.vectorStore);

  return { embedding, vectorStore };
}

function resolveEmbeddingProvider(definition: EmbeddingProviderDefinition): EmbeddingProvider {
  if (isEmbeddingProviderInstance(definition)) {
    return definition;
  }

  if (definition.provider === 'venice') {
    const { provider: _provider, ...rest } = definition;
    void _provider;
    return new VeniceEmbeddingProvider(rest);
  }
  if (definition.provider === 'openai') {
    const { provider: _provider, ...rest } = definition;
    void _provider;
    return new OpenAIEmbeddingProvider(rest);
  }

  throw new Error(`Unsupported embedding provider: ${(definition as { provider?: string }).provider}`);
}

function resolveVectorStoreProvider(definition: VectorStoreProviderDefinition): VectorStoreProvider {
  if (isVectorStoreProviderInstance(definition)) {
    return definition;
  }

  if (definition.provider === 'pinecone') {
    const { provider: _provider, ...rest } = definition;
    void _provider;
    return new PineconeVectorStore(rest);
  }
  if (definition.provider === 'pgvector') {
    const { provider: _provider, ...rest } = definition;
    void _provider;
    return new PgVectorStore(rest);
  }

  throw new Error(`Unsupported vector store provider: ${(definition as { provider?: string }).provider}`);
}

function isEmbeddingProviderInstance(value: unknown): value is EmbeddingProvider {
  return typeof value === 'object' && value !== null && 'generateEmbedding' in value;
}

function isVectorStoreProviderInstance(value: unknown): value is VectorStoreProvider {
  return typeof value === 'object' && value !== null && 'query' in value && 'upsert' in value;
}

export function resolveSemanticSearchProvidersFromEnv(env: SemanticProviderEnv): SemanticSearchProviders {
  const embeddingProvider = (env.EMBEDDING_PROVIDER || 'openai').toLowerCase();
  const vectorProvider = (env.VECTOR_STORE_PROVIDER || 'pgvector').toLowerCase();

  let embedding: EmbeddingProviderDefinition;
  if (embeddingProvider === 'venice') {
    if (!env.VENICE_API_KEY) {
      throw new Error('Missing VENICE_API_KEY for embedding provider "venice"');
    }
    embedding = {
      provider: 'venice',
      apiKey: env.VENICE_API_KEY,
      model: env.VENICE_MODEL || 'text-embedding-bge-m3',
    };
  } else if (embeddingProvider === 'openai') {
    if (!env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY for embedding provider "openai"');
    }
    embedding = {
      provider: 'openai',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      baseUrl: env.OPENAI_EMBEDDING_BASE_URL || 'https://api.openai.com/v1/embeddings',
      apiVersion: env.OPENAI_EMBEDDING_API_VERSION,
    };
  } else {
    throw new Error(`Unsupported EMBEDDING_PROVIDER: ${embeddingProvider}`);
  }

  let vectorStore: VectorStoreProviderDefinition;
  if (vectorProvider === 'pinecone') {
    if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
      throw new Error('Missing PINECONE_API_KEY or PINECONE_INDEX for vector store provider "pinecone"');
    }
    vectorStore = {
      provider: 'pinecone',
      apiKey: env.PINECONE_API_KEY,
      index: env.PINECONE_INDEX,
      namespace: env.PINECONE_NAMESPACE,
    };
  } else if (vectorProvider === 'pgvector') {
    if (!env.PGVECTOR_DATABASE_URL) {
      throw new Error('Missing PGVECTOR_DATABASE_URL for vector store provider "pgvector"');
    }
    const parsedDim = env.PGVECTOR_DIMENSION ? Number(env.PGVECTOR_DIMENSION) : undefined;
    vectorStore = {
      provider: 'pgvector',
      databaseUrl: env.PGVECTOR_DATABASE_URL,
      table: env.PGVECTOR_TABLE || 'semantic_vectors',
      dimension: Number.isFinite(parsedDim) && (parsedDim as number) > 0 ? (parsedDim as number) : 1536,
    };
  } else {
    throw new Error(`Unsupported VECTOR_STORE_PROVIDER: ${vectorProvider}`);
  }

  return resolveSemanticSearchProviders({ embedding, vectorStore });
}
