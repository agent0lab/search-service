import type { Context, Next } from 'hono';
import type { Env } from '../types.js';
import { MAX_QUERY_LENGTH, MAX_TOP_K, MAX_REQUEST_SIZE } from '../types.js';
import { createErrorResponse, ErrorCode } from '../utils/errors.js';

/**
 * Middleware to validate search request body
 */
export async function validateSearchRequest(c: Context<{ Bindings: Env }>, next: Next) {
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
          ErrorCode.VALIDATION_ERROR
        ),
        400
      );
    }

    // Check request body size (after parsing, check stringified size)
    const bodyString = JSON.stringify(body);
    if (new TextEncoder().encode(bodyString).length > MAX_REQUEST_SIZE) {
      return c.json(
        createErrorResponse(
          new Error(`Request body too large. Maximum size is ${MAX_REQUEST_SIZE} bytes`),
          400,
          ErrorCode.VALIDATION_ERROR
        ),
        400
      );
    }

    // Validate query field
    if (!body || typeof body !== 'object') {
      return c.json(
        createErrorResponse(
          new Error('Request body must be an object'),
          400,
          ErrorCode.VALIDATION_ERROR
        ),
        400
      );
    }

    const request = body as Record<string, unknown>;

    if (!request.query || typeof request.query !== 'string') {
      return c.json(
        createErrorResponse(
          new Error('Missing or invalid query parameter. Query must be a non-empty string'),
          400,
          ErrorCode.VALIDATION_ERROR
        ),
        400
      );
    }

    if (request.query.length === 0) {
      return c.json(
        createErrorResponse(
          new Error('Query cannot be empty'),
          400,
          ErrorCode.VALIDATION_ERROR
        ),
        400
      );
    }

    if (request.query.length > MAX_QUERY_LENGTH) {
      return c.json(
        createErrorResponse(
          new Error(`Query too long. Maximum length is ${MAX_QUERY_LENGTH} characters`),
          400,
          ErrorCode.VALIDATION_ERROR
        ),
        400
      );
    }

    // Validate topK
    if (request.topK !== undefined) {
      if (typeof request.topK !== 'number' || !Number.isInteger(request.topK)) {
        return c.json(
          createErrorResponse(
            new Error('topK must be an integer'),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }

      if (request.topK < 1) {
        return c.json(
          createErrorResponse(
            new Error('topK must be at least 1'),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }

      if (request.topK > MAX_TOP_K) {
        return c.json(
          createErrorResponse(
            new Error(`topK cannot exceed ${MAX_TOP_K}`),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }
    }

    // Validate minScore
    if (request.minScore !== undefined) {
      if (typeof request.minScore !== 'number') {
        return c.json(
          createErrorResponse(
            new Error('minScore must be a number'),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }

      if (request.minScore < 0 || request.minScore > 1) {
        return c.json(
          createErrorResponse(
            new Error('minScore must be between 0 and 1'),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }
    }

    // Validate filters structure
    if (request.filters !== undefined) {
      if (typeof request.filters !== 'object' || request.filters === null || Array.isArray(request.filters)) {
        return c.json(
          createErrorResponse(
            new Error('filters must be an object'),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }

      const filters = request.filters as Record<string, unknown>;

      // Validate capabilities array if present
      if (filters.capabilities !== undefined) {
        if (!Array.isArray(filters.capabilities)) {
          return c.json(
            createErrorResponse(
              new Error('filters.capabilities must be an array'),
              400,
              ErrorCode.VALIDATION_ERROR
            ),
            400
          );
        }

        if (!filters.capabilities.every((cap) => typeof cap === 'string')) {
          return c.json(
            createErrorResponse(
              new Error('filters.capabilities must be an array of strings'),
              400,
              ErrorCode.VALIDATION_ERROR
            ),
            400
          );
        }
      }

      // Validate inputMode and outputMode if present
      if (filters.inputMode !== undefined && typeof filters.inputMode !== 'string') {
        return c.json(
          createErrorResponse(
            new Error('filters.inputMode must be a string'),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }

      if (filters.outputMode !== undefined && typeof filters.outputMode !== 'string') {
        return c.json(
          createErrorResponse(
            new Error('filters.outputMode must be a string'),
            400,
            ErrorCode.VALIDATION_ERROR
          ),
          400
        );
      }
    }

    // Store validated body in context for use in handler
    (c as any).set('validatedBody', request);

    await next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    return c.json(
      createErrorResponse(
        new Error('Request validation failed'),
        400,
        ErrorCode.VALIDATION_ERROR
      ),
      400
    );
  }
}

