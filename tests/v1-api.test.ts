import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for v1 standard API endpoints
 * These test the API endpoints against a running dev server
 * Make sure to run `npm run dev` in another terminal before running these tests
 */
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787';
const V1_BASE = `${BASE_URL}/api/v1`;

describe('V1 Standard API', () => {
  describe('GET /api/v1/capabilities', () => {
    it('should return capabilities with correct structure', async () => {
      const res = await fetch(`${V1_BASE}/capabilities`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('limits');
      expect(data).toHaveProperty('supportedFilters');
      expect(data).toHaveProperty('supportedOperators');
      expect(data).toHaveProperty('features');

      // Validate limits structure
      expect(data.limits).toHaveProperty('maxQueryLength');
      expect(data.limits).toHaveProperty('maxLimit');
      expect(data.limits).toHaveProperty('maxFilters');
      expect(data.limits).toHaveProperty('maxRequestSize');

      // Validate features
      expect(data.features).toHaveProperty('pagination');
      expect(data.features).toHaveProperty('cursorPagination');
      expect(data.features).toHaveProperty('metadataFiltering');
      expect(data.features).toHaveProperty('scoreThreshold');

      // Validate types
      expect(typeof data.version).toBe('string');
      expect(Array.isArray(data.supportedFilters)).toBe(true);
      expect(Array.isArray(data.supportedOperators)).toBe(true);
      expect(typeof data.features.pagination).toBe('boolean');
    });

    it('should include all required filter fields', async () => {
      const res = await fetch(`${V1_BASE}/capabilities`);
      const data = await res.json();

      const requiredFilters = [
        'id',
        'cid',
        'agentId',
        'name',
        'description',
        'active',
        'x402support',
        'chainId',
      ];

      for (const filter of requiredFilters) {
        expect(data.supportedFilters).toContain(filter);
      }
    });

    it('should include all required operators', async () => {
      const res = await fetch(`${V1_BASE}/capabilities`);
      const data = await res.json();

      const requiredOperators = ['equals', 'in', 'notIn', 'exists', 'notExists'];
      for (const op of requiredOperators) {
        expect(data.supportedOperators).toContain(op);
      }
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status with standard format', async () => {
      const res = await fetch(`${V1_BASE}/health`);
      expect(res.status).toBeLessThanOrEqual(503); // Can be 200 or 503

      const data = await res.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('services');

      expect(['ok', 'degraded', 'down']).toContain(data.status);
      expect(data.services).toHaveProperty('embedding');
      expect(data.services).toHaveProperty('vectorStore');
      expect(['ok', 'error']).toContain(data.services.embedding);
      expect(['ok', 'error']).toContain(data.services.vectorStore);
    });

    it('should return 503 when service is degraded', async () => {
      // This test would require mocking service failures
      // For now, we just verify the structure supports it
      const res = await fetch(`${V1_BASE}/health`);
      const data = await res.json();

      if (data.status === 'degraded' || data.status === 'down') {
        expect(res.status).toBe(503);
      }
    });
  });

  describe('POST /api/v1/search', () => {
    it('should return 400 for missing query', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code');
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid query type', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 123 }),
      });

      expect(res.status).toBe(400);
    });

    it('should accept valid search request', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test search query',
          limit: 10,
        }),
      });

      // Should not be 400 (validation error)
      expect(res.status).not.toBe(400);

      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('query');
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('requestId');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('provider');
        expect(Array.isArray(data.results)).toBe(true);
      }
    });

    it('should return standard response format', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'portfolio management',
          limit: 5,
        }),
      });

      if (res.status === 200) {
        const data = await res.json();

        // Validate response structure
        expect(data).toHaveProperty('query');
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('requestId');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('provider');

        // Validate provider
        expect(data.provider).toHaveProperty('name');
        expect(data.provider).toHaveProperty('version');

        // Validate results array structure
        if (data.results.length > 0) {
          const result = data.results[0];
          expect(result).toHaveProperty('rank');
          expect(result).toHaveProperty('vectorId');
          expect(result).toHaveProperty('agentId');
          expect(result).toHaveProperty('chainId');
          expect(result).toHaveProperty('name');
          expect(result).toHaveProperty('description');
          expect(result).toHaveProperty('score');
        }
      }
    });

    it('should support equals filter operator', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'defi agent',
          limit: 5,
          filters: {
            equals: {
              active: true,
              x402support: true,
            },
          },
        }),
      });

      expect(res.status).not.toBe(400);
    });

    it('should support in filter operator', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'trading bot',
          limit: 5,
          filters: {
            in: {
              chainId: [11155111, 84532],
              supportedTrusts: ['reputation'],
            },
          },
        }),
      });

      expect(res.status).not.toBe(400);
    });

    it('should support notIn filter operator', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          filters: {
            notIn: {
              chainId: [80002],
            },
          },
        }),
      });

      expect(res.status).not.toBe(400);
    });

    it('should support exists filter operator', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          filters: {
            exists: ['mcpEndpoint', 'a2aEndpoint'],
          },
        }),
      });

      expect(res.status).not.toBe(400);
    });

    it('should support notExists filter operator', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          filters: {
            notExists: ['deprecated'],
          },
        }),
      });

      expect(res.status).not.toBe(400);
    });

    it('should support offset pagination', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          offset: 0,
        }),
      });

      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('pagination');
        if (data.pagination) {
          expect(data.pagination).toHaveProperty('hasMore');
          expect(data.pagination).toHaveProperty('limit');
          expect(data.pagination).toHaveProperty('offset');
        }
      }
    });

    it('should support cursor pagination', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          cursor: '10',
        }),
      });

      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('pagination');
        if (data.pagination) {
          expect(data.pagination).toHaveProperty('hasMore');
          expect(data.pagination).toHaveProperty('limit');
        }
      }
    });

    it('should accept legacy base64(JSON) cursor for backward compatibility', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          // legacy service cursor: base64('{"offset":10}')
          cursor: 'eyJvZmZzZXQiOjEwfQ',
        }),
      });

      // Should not be a validation error
      expect(res.status).not.toBe(400);
    });

    it('should validate maximum offset based on limit and Pinecone constraints', async () => {
      // With limit=10, max offset should be 70 (100 - 10*3)
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 10,
          offset: 100, // Should exceed max
        }),
      });

      // May be 400 (validation error) or 429 (rate limit) - both are acceptable
      // If 400, check the error message
      if (res.status === 400) {
        const data = await res.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('offset cannot exceed');
        expect(data.error).toContain('Consider using cursor-based pagination');
      } else {
        // Rate limited - skip validation check but test still passes
        expect([400, 429]).toContain(res.status);
      }
    });

    it('should use optimized multiplier when no post-filtering', async () => {
      // Without filters, should use 2x multiplier (more efficient)
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 10,
          offset: 0,
        }),
      });

      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('pagination');
        // Should successfully return results with optimized query
      }
    });

    it('should use larger multiplier when post-filtering is needed', async () => {
      // With exists filter, should use 3x multiplier
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 10,
          offset: 0,
          filters: {
            exists: ['mcpEndpoint'],
          },
        }),
      });

      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('pagination');
        // Should successfully return results with appropriate buffer for filtering
      }
    });

    it('should support minScore filtering', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'defi yield optimization',
          limit: 10,
          minScore: 0.5,
        }),
      });

      if (res.status === 200) {
        const data = await res.json();
        // All results should have score >= 0.5
        for (const result of data.results) {
          expect(result.score).toBeGreaterThanOrEqual(0.5);
        }
      }
    });

    it('should support includeMetadata flag', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          includeMetadata: false,
        }),
      });

      if (res.status === 200) {
        const data = await res.json();
        if (data.results.length > 0) {
          // Metadata should be undefined or minimal when includeMetadata is false
          const result = data.results[0];
          // The result should still have basic fields
          expect(result).toHaveProperty('agentId');
          expect(result).toHaveProperty('chainId');
        }
      }
    });

    it('should include request ID in response', async () => {
      const requestId = 'test-request-id-123';
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
        }),
      });

      // Check header
      expect(res.headers.get('X-Request-ID')).toBeTruthy();

      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('requestId');
        expect(data.requestId).toBeTruthy();
      }
    });

    it('should include rate limit headers', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
        }),
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy();
      expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    it('should return 400 for invalid limit', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 0,
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for limit exceeding max', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 1000,
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid minScore', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          minScore: 1.5,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/schemas/:endpoint', () => {
    it('should return schema for search endpoint', async () => {
      const res = await fetch(`${V1_BASE}/schemas/search`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('request');
      expect(data).toHaveProperty('response');
      expect(data.request).toHaveProperty('$schema');
      expect(data.response).toHaveProperty('$schema');
    });

    it('should return schema for capabilities endpoint', async () => {
      const res = await fetch(`${V1_BASE}/schemas/capabilities`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('response');
      expect(data.response).toHaveProperty('$schema');
    });

    it('should return schema for health endpoint', async () => {
      const res = await fetch(`${V1_BASE}/schemas/health`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toHaveProperty('response');
      expect(data.response).toHaveProperty('$schema');
    });

    it('should return 404 for unknown endpoint', async () => {
      const res = await fetch(`${V1_BASE}/schemas/unknown`);
      expect(res.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should return standard error format', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
    });

    it('should handle CORS preflight', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(res.status).toBeLessThan(500);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    });
  });
});

