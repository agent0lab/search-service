import type { Context } from 'hono';
import type { Env } from '../types.js';
import type { SemanticQueryRequest } from '../utils/interfaces.js';
import type { SemanticSearchResponse } from '../utils/types.js';
import { SemanticSearchManager } from '../utils/manager.js';
import { resolveSemanticSearchProviders } from '../utils/config.js';
import { RequestLogger } from '../utils/request-logger.js';
import { createErrorResponse, ErrorCode } from '../utils/errors.js';

/**
 * Get client IP address from request
 */
function getClientIP(c: Context<{ Bindings: Env }>): string {
  const cfIP = c.req.header('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return 'unknown';
}

export async function searchHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const startTime = Date.now();
  const ipAddress = getClientIP(c);
  const requestLogger = new RequestLogger(c.env.DB);

  // Get validated body from middleware
  const body = (c as any).get('validatedBody') as SemanticQueryRequest | undefined;
  if (!body) {
    // This shouldn't happen if validation middleware is properly configured
    const errorResponse = createErrorResponse(
      new Error('Request validation failed'),
      400,
      ErrorCode.VALIDATION_ERROR
    );
    await requestLogger.logRequest({
      ipAddress,
      query: '',
      responseCount: 0,
      durationMs: Date.now() - startTime,
      statusCode: 400,
      errorMessage: errorResponse.error,
    });
    return c.json(errorResponse, 400);
  }

  try {
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

    const durationMs = Date.now() - startTime;

    // Log successful request
    await requestLogger.logRequest({
      ipAddress,
      query: body.query,
      topK: body.topK,
      filters: body.filters,
      responseCount: response.results.length,
      durationMs,
      statusCode: 200,
    });

    return c.json(response);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('Search error:', error);

    const errorResponse = createErrorResponse(error, 500, ErrorCode.INTERNAL_ERROR);

    // Log failed request
    await requestLogger.logRequest({
      ipAddress,
      query: body.query || '',
      topK: body.topK,
      filters: body.filters,
      responseCount: 0,
      durationMs,
      statusCode: errorResponse.status,
      errorMessage: errorResponse.error,
    });

    return c.json(errorResponse, errorResponse.status);
  }
}

