import type { SemanticSearchResponse, SemanticSearchFilters } from './types';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://agent0-semantic-search.dawid-pisarczyk.workers.dev';

export interface SearchRequest {
  query: string;
  topK?: number;
  filters?: SemanticSearchFilters;
  minScore?: number;
}

/**
 * Client to call the worker search endpoint
 */
export async function searchAgents(request: SearchRequest): Promise<SemanticSearchResponse> {
  const response = await fetch(`${WORKER_URL}/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: request.query,
      topK: request.topK || 10,
      filters: request.filters,
      minScore: request.minScore,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Search failed' })) as { error?: string };
    throw new Error(errorData.error || `Search failed: ${response.statusText}`);
  }

  return response.json() as Promise<SemanticSearchResponse>;
}

