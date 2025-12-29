import type { StandardSearchRequest, StandardSearchResponse, StandardErrorResponse } from './types';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://agent0-semantic-search.dawid-pisarczyk.workers.dev';

/**
 * Client to call the worker v1 search endpoint
 * Implements the service's v1 search schema
 */
export async function searchAgents(request: StandardSearchRequest): Promise<StandardSearchResponse> {
  const response = await fetch(`${WORKER_URL}/api/v1/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
    },
    body: JSON.stringify({
      query: request.query,
      limit: request.limit || 10,
      offset: request.offset,
      cursor: request.cursor,
      filters: request.filters,
      minScore: request.minScore,
      includeMetadata: request.includeMetadata ?? true,
      name: request.name,
      chains: request.chains,
      sort: request.sort,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Search failed' })) as StandardErrorResponse | { error?: string };
    throw new Error(errorData.error || `Search failed: ${response.statusText}`);
  }

  return response.json() as Promise<StandardSearchResponse>;
}

