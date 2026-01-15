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

  // Check Venice API
  try {
    const veniceResponse = await fetch('https://api.venice.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.VENICE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: 'test',
        model: 'text-embedding-bge-m3',
      }),
    });

    if (!veniceResponse.ok) {
      status.services.embedding = 'error';
      status.status = 'degraded';
    }
  } catch (error) {
    status.services.embedding = 'error';
    status.status = 'degraded';
  }

  // Check Pinecone (lightweight check - just verify API key format)
  // Full connectivity check would require actual query, which is expensive
  if (!c.env.PINECONE_API_KEY || !c.env.PINECONE_INDEX) {
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



<<<<<<< Updated upstream:worker/src/routes/v1/health.ts
=======




>>>>>>> Stashed changes:worker/src/routes/health.ts
