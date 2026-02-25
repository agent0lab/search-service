/**
 * Enhanced health check endpoint (v1)
 * Returns detailed health status with version, uptime, and service status
 */
import type { Context } from 'hono';
import type { Env } from '../../types.js';
import type { StandardHealthResponse } from '../../utils/standard-types.js';

export async function healthHandlerV1(c: Context<{ Bindings: Env }>): Promise<Response> {
  const status: StandardHealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      embedding: 'ok',
      vectorStore: 'ok',
    },
  };

  const embeddingProvider = (c.env.EMBEDDING_PROVIDER || 'openai').toLowerCase();
  const vectorStoreProvider = (c.env.VECTOR_STORE_PROVIDER || 'pgvector').toLowerCase();

  // Check embedding provider configuration/connectivity.
  try {
    if (embeddingProvider === 'openai') {
      if (!c.env.OPENAI_API_KEY) {
        status.services.embedding = 'error';
        status.status = 'degraded';
      } else {
        const openaiResponse = await fetch(c.env.OPENAI_EMBEDDING_BASE_URL || 'https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: 'test',
            model: c.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
            encoding_format: 'float',
          }),
        });

        if (!openaiResponse.ok) {
          status.services.embedding = 'error';
          status.status = 'degraded';
        }
      }
    } else if (embeddingProvider === 'venice') {
      if (!c.env.VENICE_API_KEY) {
        status.services.embedding = 'error';
        status.status = 'degraded';
      } else {
        const veniceResponse = await fetch('https://api.venice.ai/api/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${c.env.VENICE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: 'test',
            model: c.env.VENICE_MODEL || 'text-embedding-bge-m3',
          }),
        });

        if (!veniceResponse.ok) {
          status.services.embedding = 'error';
          status.status = 'degraded';
        }
      }
    } else {
      status.services.embedding = 'error';
      status.status = 'degraded';
    }
  } catch {
    status.services.embedding = 'error';
    status.status = 'degraded';
  }

  // Check vector store configuration.
  if (vectorStoreProvider === 'pgvector') {
    if (!c.env.PGVECTOR_DATABASE_URL) {
      status.services.vectorStore = 'error';
      status.status = 'degraded';
    }
  } else if (vectorStoreProvider === 'pinecone') {
    if (!c.env.PINECONE_API_KEY || !c.env.PINECONE_INDEX) {
      status.services.vectorStore = 'error';
      status.status = 'degraded';
    }
  } else {
    status.services.vectorStore = 'error';
    status.status = 'degraded';
  }

  // Note: Uptime tracking would require persistent storage or global state
  // For now, we'll omit it or set it to a placeholder
  // In a production system, you might track this in D1 or KV storage
  // status.uptime = calculateUptime();

  const statusCode = status.status === 'ok' ? 200 : 503;
  return c.json(status, statusCode);
}
