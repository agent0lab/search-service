import type { Context } from 'hono';
import type { Env } from '../types.js';

interface HealthStatus {
  status: 'ok' | 'degraded';
  services: {
    venice: 'ok' | 'error';
    pinecone: 'ok' | 'error';
  };
  timestamp: string;
}

export async function healthHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const status: HealthStatus = {
    status: 'ok',
    services: {
      venice: 'ok',
      pinecone: 'ok',
    },
    timestamp: new Date().toISOString(),
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
      status.services.venice = 'error';
      status.status = 'degraded';
    }
  } catch (error) {
    status.services.venice = 'error';
    status.status = 'degraded';
  }

  // Check Pinecone (lightweight check - just verify API key format)
  // Full connectivity check would require actual query, which is expensive
  if (!c.env.PINECONE_API_KEY || !c.env.PINECONE_INDEX) {
    status.services.pinecone = 'error';
    status.status = 'degraded';
  }

  const statusCode = status.status === 'ok' ? 200 : 503;
  return c.json(status, statusCode);
}

