/**
 * Validation middleware for v1 standard API endpoints
 */
import type { Context, Next } from 'hono';
import type { Env } from '../types.js';
import { MAX_QUERY_LENGTH, MAX_TOP_K } from '../types.js';
import { createErrorResponse, ErrorCode } from '../utils/errors.js';
import { getRequestId } from './request-id.js';
import type { StandardSearchRequest, StandardFilters } from '../utils/standard-types.js';

const MAX_REQUEST_SIZE = 1048576; // 1MB
const MAX_FILTERS = 50;

/**
 * Validate standard search request
 */
export async function validateSearchRequestV1(c: Context<{ Bindings: Env }>, next: Next) {
  const requestId = getRequestId(c);
  
  // Helper to create error response with requestId
  const createError = (error: unknown, status: number, code?: ErrorCode) => {
    return createErrorResponse(error, status, code, requestId);
  };

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch (error) {
      return c.json(
        createErrorResponse(
          new Error('Invalid JSON in request body'),
          400,
          ErrorCode.VALIDATION_ERROR,
          requestId
        ),
        400
      );
    }

    // Check request body size
    const bodyString = JSON.stringify(body);
    if (new TextEncoder().encode(bodyString).length > MAX_REQUEST_SIZE) {
      return c.json(createError(new Error(`Request body too large. Maximum size is ${MAX_REQUEST_SIZE} bytes`), 400, ErrorCode.VALIDATION_ERROR), 400);
    }

    // Validate request structure
    if (!body || typeof body !== 'object') {
      return c.json(createError(new Error('Request body must be an object'), 400, ErrorCode.VALIDATION_ERROR), 400);
    }

    const request = body as Record<string, unknown>;

    // Validate query (required)
    if (!request.query || typeof request.query !== 'string') {
      return c.json(createError(new Error('Missing or invalid query parameter. Query must be a non-empty string'), 400, ErrorCode.VALIDATION_ERROR), 400);
    }

    if (request.query.length === 0) {
      return c.json(createError(new Error('Query cannot be empty'), 400, ErrorCode.VALIDATION_ERROR), 400);
    }

    if (request.query.length > MAX_QUERY_LENGTH) {
      return c.json(createError(new Error(`Query too long. Maximum length is ${MAX_QUERY_LENGTH} characters`), 400, ErrorCode.VALIDATION_ERROR), 400);
    }

    // Validate limit
    if (request.limit !== undefined) {
      if (typeof request.limit !== 'number' || !Number.isInteger(request.limit)) {
        return c.json(createError(new Error('limit must be an integer'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }

      if (request.limit < 1) {
        return c.json(createError(new Error('limit must be at least 1'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }

      if (request.limit > MAX_TOP_K) {
        return c.json(createError(new Error(`limit cannot exceed ${MAX_TOP_K}`), 400, ErrorCode.VALIDATION_ERROR), 400);
      }
    }

    // Validate offset
    if (request.offset !== undefined) {
      if (typeof request.offset !== 'number' || !Number.isInteger(request.offset)) {
        return c.json(createError(new Error('offset must be an integer'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }

      if (request.offset < 0) {
        return c.json(createError(new Error('offset must be non-negative'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }

      // Validate maximum offset based on Pinecone's topK limit
      // Since we need to fetch offset + limit * multiplier, and max topK is 100,
      // we cap offset at a reasonable maximum (e.g., 70 for limit=10 with 3x multiplier)
      // This prevents inefficient queries that would require fetching >100 results
      const limit = request.limit ?? 10;
      const maxOffset = MAX_TOP_K - (limit * 3); // Conservative estimate
      if (request.offset > maxOffset) {
        return c.json(
          createError(
            new Error(`offset cannot exceed ${maxOffset} (based on limit=${limit} and Pinecone's max topK=${MAX_TOP_K}). Consider using cursor-based pagination for deeper results.`),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }
    }

    // Validate cursor
    if (request.cursor !== undefined) {
      if (typeof request.cursor !== 'string') {
        return c.json(createError(new Error('cursor must be a string'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }
      
      // Decode cursor to validate offset (if cursor is provided, it takes precedence over offset)
      try {
        const cursorJson = atob(request.cursor);
        const cursorData = JSON.parse(cursorJson) as { offset?: number };
        if (cursorData.offset !== undefined) {
          const limit = request.limit ?? 10;
          const maxOffset = MAX_TOP_K - (limit * 3);
          if (cursorData.offset > maxOffset) {
            return c.json(
              createError(
                new Error(`Cursor offset cannot exceed ${maxOffset} (based on limit=${limit} and Pinecone's max topK=${MAX_TOP_K})`),
                400,
                ErrorCode.VALIDATION_ERROR
              ),
              400
            );
          }
        }
      } catch {
        // Invalid cursor format - will be handled by pagination decoder
        // We don't fail here to allow the handler to provide a better error message
      }
    }

    // Validate minScore
    if (request.minScore !== undefined) {
      if (typeof request.minScore !== 'number') {
        return c.json(createError(new Error('minScore must be a number'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }

      if (request.minScore < 0 || request.minScore > 1) {
        return c.json(createError(new Error('minScore must be between 0 and 1'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }
    }

    // Validate includeMetadata
    if (request.includeMetadata !== undefined) {
      if (typeof request.includeMetadata !== 'boolean') {
        return c.json(createError(new Error('includeMetadata must be a boolean'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }
    }

    // Validate name (optional, for substring search)
    if (request.name !== undefined) {
      if (typeof request.name !== 'string') {
        return c.json(createError(new Error('name must be a string'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }
    }

    // Validate chains (optional, for multi-chain search)
    if (request.chains !== undefined) {
      if (request.chains !== 'all' && (!Array.isArray(request.chains) || !request.chains.every(id => typeof id === 'number' && Number.isInteger(id)))) {
        return c.json(createError(new Error('chains must be "all" or an array of integers'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }
    }

    // Validate sort (optional, for sorting results)
    if (request.sort !== undefined) {
      if (!Array.isArray(request.sort) || !request.sort.every(s => typeof s === 'string')) {
        return c.json(createError(new Error('sort must be an array of strings (format: "field:direction")'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }
    }

    // Validate filters structure
    if (request.filters !== undefined) {
      if (typeof request.filters !== 'object' || request.filters === null || Array.isArray(request.filters)) {
        return c.json(createError(new Error('filters must be an object'), 400, ErrorCode.VALIDATION_ERROR), 400);
      }

      const filters = request.filters as StandardFilters;
      let filterCount = 0;

      // Validate equals
      if (filters.equals !== undefined) {
        if (typeof filters.equals !== 'object' || filters.equals === null || Array.isArray(filters.equals)) {
            return c.json(createError(new Error('filters.equals must be an object'), 400, ErrorCode.VALIDATION_ERROR), 400);
        }
        filterCount += Object.keys(filters.equals).length;
      }

      // Validate in
      if (filters.in !== undefined) {
        if (typeof filters.in !== 'object' || filters.in === null || Array.isArray(filters.in)) {
            return c.json(createError(new Error('filters.in must be an object'), 400, ErrorCode.VALIDATION_ERROR), 400);
        }
        for (const [key, value] of Object.entries(filters.in)) {
          if (!Array.isArray(value)) {
              return c.json(createError(new Error(`filters.in.${key} must be an array`), 400, ErrorCode.VALIDATION_ERROR), 400);
          }
        }
        filterCount += Object.keys(filters.in).length;
      }

      // Validate notIn
      if (filters.notIn !== undefined) {
        if (typeof filters.notIn !== 'object' || filters.notIn === null || Array.isArray(filters.notIn)) {
            return c.json(createError(new Error('filters.notIn must be an object'), 400, ErrorCode.VALIDATION_ERROR), 400);
        }
        for (const [key, value] of Object.entries(filters.notIn)) {
          if (!Array.isArray(value)) {
              return c.json(createError(new Error(`filters.notIn.${key} must be an array`), 400, ErrorCode.VALIDATION_ERROR), 400);
          }
        }
        filterCount += Object.keys(filters.notIn).length;
      }

      // Validate exists
      if (filters.exists !== undefined) {
        if (!Array.isArray(filters.exists)) {
            return c.json(createError(new Error('filters.exists must be an array'), 400, ErrorCode.VALIDATION_ERROR), 400);
        }
        if (!filters.exists.every(field => typeof field === 'string')) {
            return c.json(createError(new Error('filters.exists must be an array of strings'), 400, ErrorCode.VALIDATION_ERROR), 400);
        }
        filterCount += filters.exists.length;
      }

      // Validate notExists
      if (filters.notExists !== undefined) {
        if (!Array.isArray(filters.notExists)) {
            return c.json(createError(new Error('filters.notExists must be an array'), 400, ErrorCode.VALIDATION_ERROR), 400);
        }
        if (!filters.notExists.every(field => typeof field === 'string')) {
            return c.json(createError(new Error('filters.notExists must be an array of strings'), 400, ErrorCode.VALIDATION_ERROR), 400);
        }
        filterCount += filters.notExists.length;
      }

      // Check total filter count
      if (filterCount > MAX_FILTERS) {
        return c.json(createError(new Error(`Too many filters. Maximum is ${MAX_FILTERS}`), 400, ErrorCode.VALIDATION_ERROR), 400);
      }
    }

    // Store validated body in context
    (c as any).set('validatedBody', request as StandardSearchRequest);

    await next();
  } catch (error) {
    console.error('Validation middleware error:', error);
      return c.json(createError(new Error('Request validation failed'), 400, ErrorCode.VALIDATION_ERROR), 400);
  }
}

