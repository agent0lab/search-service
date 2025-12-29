/**
 * JSON Schema endpoints for API validation
 * Optional endpoint to expose JSON schemas for request/response validation
 */
import type { Context } from 'hono';
import type { Env } from '../../types.js';
import { createErrorResponse, ErrorCode } from '../../utils/errors.js';
import { getRequestId } from '../../middleware/request-id.js';

const SEARCH_REQUEST_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      maxLength: 1000,
      description: 'Natural language search query',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
      description: 'Maximum number of results to return',
    },
    offset: {
      type: 'integer',
      minimum: 0,
      description: 'Offset for pagination',
    },
    cursor: {
      type: 'string',
      description: 'Cursor for cursor-based pagination. SDK-compatible format: decimal string offset (e.g., "10"). Also accepts JSON string cursors with "_global_offset" and legacy base64(JSON) cursors.',
    },
    filters: {
      type: 'object',
      properties: {
        equals: {
          type: 'object',
          description: 'Exact match for a single value',
          additionalProperties: true,
        },
        in: {
          type: 'object',
          description: 'Match any value in array (OR logic)',
          additionalProperties: {
            type: 'array',
            items: {},
          },
        },
        notIn: {
          type: 'object',
          description: 'Exclude values in array',
          additionalProperties: {
            type: 'array',
            items: {},
          },
        },
        exists: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field must exist (not null/undefined)',
        },
        notExists: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field must not exist',
        },
      },
    },
    minScore: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Minimum similarity score threshold',
    },
    includeMetadata: {
      type: 'boolean',
      default: true,
      description: 'Include full metadata in response',
    },
  },
  required: ['query'],
};

const SEARCH_RESPONSE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    query: { type: 'string' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rank: { type: 'integer' },
          vectorId: { type: 'string' },
          agentId: { type: 'string' },
          chainId: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          metadata: { type: 'object', additionalProperties: true },
          matchReasons: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['rank', 'vectorId', 'agentId', 'chainId', 'name', 'description', 'score'],
      },
    },
    total: { type: 'integer' },
    pagination: {
      type: 'object',
      properties: {
        hasMore: { type: 'boolean' },
        nextCursor: { type: 'string' },
        limit: { type: 'integer' },
        offset: { type: 'integer' },
      },
    },
    requestId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    provider: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
      },
      required: ['name', 'version'],
    },
  },
  required: ['query', 'results', 'total', 'requestId', 'timestamp', 'provider'],
};

const CAPABILITIES_RESPONSE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    version: { type: 'string' },
    limits: {
      type: 'object',
      properties: {
        maxQueryLength: { type: 'integer', minimum: 1 },
        maxLimit: { type: 'integer', minimum: 1 },
        maxFilters: { type: 'integer', minimum: 0 },
        maxRequestSize: { type: 'integer', minimum: 1 },
      },
      required: ['maxQueryLength', 'maxLimit'],
    },
    supportedFilters: {
      type: 'array',
      items: { type: 'string' },
    },
    supportedOperators: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['equals', 'in', 'notIn', 'range', 'exists', 'notExists'],
      },
    },
    features: {
      type: 'object',
      properties: {
        pagination: { type: 'boolean' },
        cursorPagination: { type: 'boolean' },
        metadataFiltering: { type: 'boolean' },
        scoreThreshold: { type: 'boolean' },
      },
    },
  },
  required: ['version', 'limits', 'supportedFilters', 'supportedOperators', 'features'],
};

const HEALTH_RESPONSE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'degraded', 'down'],
    },
    timestamp: { type: 'string', format: 'date-time' },
    version: { type: 'string' },
    services: {
      type: 'object',
      properties: {
        embedding: {
          type: 'string',
          enum: ['ok', 'error'],
        },
        vectorStore: {
          type: 'string',
          enum: ['ok', 'error'],
        },
      },
      required: ['embedding', 'vectorStore'],
    },
    uptime: { type: 'integer' },
  },
  required: ['status', 'timestamp', 'version', 'services'],
};

export async function schemasHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const endpoint = c.req.param('endpoint');

  switch (endpoint) {
    case 'search':
      return c.json({
        request: SEARCH_REQUEST_SCHEMA,
        response: SEARCH_RESPONSE_SCHEMA,
      });

    case 'capabilities':
      return c.json({
        response: CAPABILITIES_RESPONSE_SCHEMA,
      });

    case 'health':
      return c.json({
        response: HEALTH_RESPONSE_SCHEMA,
      });

    default:
      // Use standard error envelope + requestId for consistent 404s
      return c.json(
        createErrorResponse(
          new Error(`Schema not found for endpoint: ${endpoint}`),
          404,
          ErrorCode.NOT_FOUND,
          getRequestId(c as any)
        ),
        404
      );
  }
}



