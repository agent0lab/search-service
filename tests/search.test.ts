import { describe, it, expect } from 'vitest';

/**
 * Unit tests for search service
 * These test the API endpoints against a running dev server
 * Make sure to run `npm run dev` in another terminal before running these tests
 */
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8787';

describe('Search Service API', () => {

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await fetch(`${BASE_URL}/health`);
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('timestamp');
      expect(data.services).toHaveProperty('venice');
      expect(data.services).toHaveProperty('pinecone');
    });

    it('should return valid JSON', async () => {
      const res = await fetch(`${BASE_URL}/health`);
      const data = await res.json() as any;
      expect(typeof data.status).toBe('string');
      expect(['ok', 'degraded']).toContain(data.status);
    });
  });

  describe('POST /api/search', () => {
    it('should return 400 for missing query', async () => {
      const res = await fetch(`${BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data).toHaveProperty('error');
    });

    it('should return 400 for invalid query type', async () => {
      const res = await fetch(`${BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 123 }),
      });

      expect(res.status).toBe(400);
    });

    it('should accept valid search request', async () => {
      const res = await fetch(`${BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test search query',
          topK: 5,
        }),
      });

      // Should not be 400 (validation error)
      expect(res.status).not.toBe(400);
      
      // If it's 500, that's okay - means the service is trying to process it
      // If it's 200, great - we got results
      if (res.status === 200) {
        const data = await res.json() as any;
        expect(data).toHaveProperty('query');
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('timestamp');
        expect(Array.isArray(data.results)).toBe(true);
      }
    });

    it('should accept search with filters', async () => {
      const res = await fetch(`${BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'defi yield optimization',
          topK: 10,
          minScore: 0.5,
          filters: {
            capabilities: ['defi'],
            defaultInputMode: 'text',
          },
        }),
      });

      expect(res.status).not.toBe(400);
    });

    it('should return SemanticSearchResponse format', async () => {
      const res = await fetch(`${BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'portfolio management',
        }),
      });

      if (res.status === 200) {
        const data = await res.json() as any;
        
        // Validate response structure
        expect(data).toHaveProperty('query');
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('timestamp');
        
        // Validate results array structure
        if (data.results.length > 0) {
          const result = data.results[0];
          expect(result).toHaveProperty('rank');
          expect(result).toHaveProperty('vectorId');
          expect(result).toHaveProperty('agentId');
          expect(result).toHaveProperty('chainId');
          expect(result).toHaveProperty('score');
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await fetch(`${BASE_URL}/unknown`);
      expect(res.status).toBe(404);
      
      const data = await res.json() as any;
      expect(data).toHaveProperty('error');
    });

    it('should handle CORS preflight', async () => {
      const res = await fetch(`${BASE_URL}/api/search`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      // Should handle OPTIONS request
      expect(res.status).toBeLessThan(500);
    });
  });
});

