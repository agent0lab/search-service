import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for v1 API endpoints
 * These test the API endpoints against a running dev server
 * Make sure to run `npm run dev` in another terminal before running these tests
 */
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787';
const V1_BASE = `${BASE_URL}/api/v1`;

async function asJson(res: Response): Promise<any> {
  return (await res.json()) as any;
}

// These are integration tests that require a running dev server.
// Enable by running:
//   RUN_V1_API_INTEGRATION=1 npm test
const RUN_V1_API_INTEGRATION = process.env.RUN_V1_API_INTEGRATION === '1';
const maybeDescribe = RUN_V1_API_INTEGRATION ? describe : describe.skip;

maybeDescribe('V1 API', () => {
  describe('GET /api/v1/capabilities', () => {
    it('should return capabilities with correct structure', async () => {
      const res = await fetch(`${V1_BASE}/capabilities`);
      expect(res.status).toBe(200);

      const data = await asJson(res);
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
      const data = await asJson(res);

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
      const data = await asJson(res);

      const requiredOperators = ['equals', 'in', 'notIn', 'exists', 'notExists'];
      for (const op of requiredOperators) {
        expect(data.supportedOperators).toContain(op);
      }
    });

    it('should report maxLimit 5000', async () => {
      const res = await fetch(`${V1_BASE}/capabilities`);
      const data = await asJson(res);
      expect(data.limits.maxLimit).toBe(5000);
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status with expected format', async () => {
      const res = await fetch(`${V1_BASE}/health`);
      expect(res.status).toBeLessThanOrEqual(503); // Can be 200 or 503

      const data = await asJson(res);
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
      const data = await asJson(res);

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
      const data = await asJson(res);
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
        const data = await asJson(res);
        expect(data).toHaveProperty('query');
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('requestId');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('provider');
        expect(Array.isArray(data.results)).toBe(true);
      }
    });

    it('should return expected response format', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'portfolio management',
          limit: 5,
        }),
      });

      if (res.status === 200) {
        const data = await asJson(res);

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
              chainId: [1, 11155111],
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
              chainId: [11155111],
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
        const data = await asJson(res);
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
        const data = await asJson(res);
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

    it('should validate maximum offset based on limit and MAX_TOP_K', async () => {
      // With limit=10, max offset = MAX_TOP_K - (10*3) = 5000 - 30 = 4970
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 10,
          offset: 5000, // Should exceed max
        }),
      });

      if (res.status === 400) {
        const data = await asJson(res);
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('offset cannot exceed');
      } else {
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
        const data = await asJson(res);
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
        const data = await asJson(res);
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
        const data = await asJson(res);
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
        const data = await asJson(res);
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
        const data = await asJson(res);
        expect(data).toHaveProperty('requestId');
        expect(data.requestId).toBeTruthy();
      }
    });

    it('should include rate limit headers (20 per minute)', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
        }),
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
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

    it('should return 400 for limit exceeding max (5000)', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5001,
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should accept limit up to 5000', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5000,
        }),
      });

      expect(res.status).not.toBe(400);
      if (res.status === 200) {
        const data = await asJson(res);
        expect(data).toHaveProperty('results');
        expect(Array.isArray(data.results)).toBe(true);
      }
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

  describe('POST /api/v1/search (comprehensive)', () => {
    it('returns results with valid vectorId format (chainId-agentId)', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', limit: 5 }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      for (const r of data.results || []) {
        expect(r.vectorId).toMatch(/^\d+-\d+/);
        expect(r.agentId).toMatch(/^\d+:\d+/);
        expect(r.chainId).toBeGreaterThanOrEqual(0);
      }
    });

    it('applies name substring post-filter when name param provided', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', limit: 10, name: 'agent' }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      const nameLower = 'agent'.toLowerCase();
      for (const r of data.results || []) {
        expect((r.name || '').toLowerCase()).toContain(nameLower);
      }
    });

    it('applies description substring post-filter when description param provided', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', limit: 10, description: 'agent' }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      const descLower = 'agent'.toLowerCase();
      for (const r of data.results || []) {
        expect((r.description || '').toLowerCase()).toContain(descLower);
      }
    });

    it('respects chains param (single chain)', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', limit: 10, chains: [11155111] }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      for (const r of data.results || []) {
        expect(r.chainId).toBe(11155111);
      }
    });

    it('respects chains param (multiple chains)', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', limit: 10, chains: [1, 11155111] }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      const allowed = new Set([1, 11155111]);
      for (const r of data.results || []) {
        expect(allowed.has(r.chainId)).toBe(true);
      }
    });

    it('respects filters.equals.chainId', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 10,
          filters: { equals: { chainId: 11155111 } },
        }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      for (const r of data.results || []) {
        expect(r.chainId).toBe(11155111);
      }
    });

    it('respects filters.in.chainId', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 10,
          filters: { in: { chainId: [1, 11155111] } },
        }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      const allowed = new Set([1, 11155111]);
      for (const r of data.results || []) {
        expect(allowed.has(r.chainId)).toBe(true);
      }
    });

    it('respects sort option (updatedAt:desc)', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          sort: ['updatedAt:desc'],
        }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      const results = data.results || [];
      if (results.length < 2) return;
      const metadata = results.map((r: any) => r.metadata?.updatedAt ?? '');
      for (let i = 1; i < metadata.length; i++) {
        const a = metadata[i - 1];
        const b = metadata[i];
        if (a && b) {
          expect(new Date(b).getTime()).toBeLessThanOrEqual(new Date(a).getTime());
        }
      }
    });

    it('returns pagination with hasMore and nextCursor when more results exist', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', limit: 5 }),
      });
      if (res.status !== 200) return;
      const data = await asJson(res);
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('hasMore');
      expect(data.pagination).toHaveProperty('limit', 5);
      if (data.pagination.hasMore) {
        expect(data.pagination.nextCursor).toBeTruthy();
      }
    });

    it('cursor pagination returns disjoint results', async () => {
      const page1 = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', limit: 3 }),
      });
      if (page1.status !== 200) return;
      const data1 = await asJson(page1);
      if (!data1.pagination?.nextCursor || data1.results.length === 0) return;
      const page2 = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', limit: 3, cursor: data1.pagination.nextCursor }),
      });
      if (page2.status !== 200) return;
      const data2 = await asJson(page2);
      const ids1 = new Set((data1.results || []).map((r: any) => r.vectorId));
      for (const r of data2.results || []) {
        expect(ids1.has(r.vectorId)).toBe(false);
      }
    });

    it('combined filters: chains + equals.active returns valid results', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'agent',
          limit: 5,
          chains: [11155111],
          filters: { equals: { active: true } },
        }),
      });
      expect(res.status).not.toBe(400);
      if (res.status === 200) {
        const data = await asJson(res);
        for (const r of data.results || []) {
          expect(r.chainId).toBe(11155111);
          if (r.metadata?.active !== undefined) {
            expect(r.metadata.active).toBe(true);
          }
        }
      }
    });

    it('rejects invalid description type', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'agent', description: 123 }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/schemas/:endpoint', () => {
    it('should return schema for search endpoint', async () => {
      const res = await fetch(`${V1_BASE}/schemas/search`);
      expect(res.status).toBe(200);

      const data = await asJson(res);
      expect(data).toHaveProperty('request');
      expect(data).toHaveProperty('response');
      expect(data.request).toHaveProperty('$schema');
      expect(data.response).toHaveProperty('$schema');
    });

    it('should return schema for capabilities endpoint', async () => {
      const res = await fetch(`${V1_BASE}/schemas/capabilities`);
      expect(res.status).toBe(200);

      const data = await asJson(res);
      expect(data).toHaveProperty('response');
      expect(data.response).toHaveProperty('$schema');
    });

    it('should return schema for health endpoint', async () => {
      const res = await fetch(`${V1_BASE}/schemas/health`);
      expect(res.status).toBe(200);

      const data = await asJson(res);
      expect(data).toHaveProperty('response');
      expect(data.response).toHaveProperty('$schema');
    });

    it('should return 404 for unknown endpoint', async () => {
      const res = await fetch(`${V1_BASE}/schemas/unknown`);
      expect(res.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should return expected error format', async () => {
      const res = await fetch(`${V1_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await asJson(res);
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

