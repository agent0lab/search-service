/**
 * Standard search endpoint (v1 API)
 * Implements the Universal Agent Semantic Search API Standard v1.0
 */
import type { Context } from 'hono';
import type { Env } from '../../types.js';
import type { StandardSearchRequest, StandardSearchResponse } from '../../utils/standard-types.js';
import { SemanticSearchManager } from '../../utils/manager.js';
import { resolveSemanticSearchProviders } from '../../utils/config.js';
import { RequestLogger } from '../../utils/request-logger.js';
import { createErrorResponse, ErrorCode } from '../../utils/errors.js';
import { getRequestId } from '../../middleware/request-id.js';
import { PROVIDER_NAME, PROVIDER_VERSION } from '../../types.js';

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

export async function searchHandlerV1(c: Context<{ Bindings: Env }>): Promise<Response> {
  const startTime = Date.now();
  const ipAddress = getClientIP(c);
  const requestId = getRequestId(c);
  const requestLogger = new RequestLogger(c.env.DB);

  // Get validated body from middleware
  const body = (c as any).get('validatedBody') as StandardSearchRequest | undefined;
  if (!body) {
    // This shouldn't happen if validation middleware is properly configured
    const errorResponse = createErrorResponse(
      new Error('Request validation failed'),
      400,
      ErrorCode.VALIDATION_ERROR,
      requestId
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

    // Perform search using v1 method
    const response: StandardSearchResponse = await manager.searchAgentsV1(
      body,
      PROVIDER_NAME,
      PROVIDER_VERSION
    );

    // Set request ID in response
    response.requestId = requestId;

    const durationMs = Date.now() - startTime;

    // Log successful request
    await requestLogger.logRequest({
      ipAddress,
      query: body.query,
      topK: body.limit,
      filters: body.filters as any,
      responseCount: response.results.length,
      durationMs,
      statusCode: 200,
    });

    return c.json(response);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('Search error:', error);

    const errorResponse = createErrorResponse(error, 500, ErrorCode.INTERNAL_ERROR, requestId);

    // Log failed request
    await requestLogger.logRequest({
      ipAddress,
      query: body?.query || '',
      topK: body?.limit,
      filters: body?.filters as any,
      responseCount: 0,
      durationMs,
      statusCode: errorResponse.status,
      errorMessage: errorResponse.error,
    });

    return c.json(errorResponse, errorResponse.status);
  }
}

