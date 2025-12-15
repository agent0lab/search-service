import { NextRequest, NextResponse } from 'next/server';

// Default subgraph URLs (matching agent0-sdk)
const DEFAULT_SUBGRAPH_URLS: Record<number, string> = {
  11155111: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT', // Ethereum Sepolia
  84532: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/GjQEDgEKqoh5Yc8MUgxoQoRATEJdEiH7HbocfR1aFiHa', // Base Sepolia
  80002: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/2A1JB18r1mF2VNP4QBH4mmxd74kbHoM6xLXC8ABAKf7j', // Polygon Amoy
};

interface SubgraphAgent {
  id: string;
  chainId: string;
  agentId: string;
  agentURI?: string;
  createdAt: string;
  registrationFile?: {
    name: string;
    description: string;
    image?: string;
    active: boolean;
  } | null;
}

async function querySubgraph(subgraphUrl: string, query: string, variables: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(subgraphUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.statusText}`);
  }

  const result = await response.json() as { data?: unknown; errors?: Array<{ message: string }> };

  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
}

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const chainIdParam = request.nextUrl.searchParams.get('chainId');
    
    // If filtering by chain, fetch more agents (100), otherwise use default limit (12)
    const limit = chainIdParam 
      ? parseInt(limitParam || '100', 10)
      : parseInt(limitParam || '12', 10);
    
    const filterChainId = chainIdParam ? parseInt(chainIdParam, 10) : null;

    // If filtering by chain, only query that chain, otherwise query all chains
    let chainsToQuery: Array<[string, string]>;
    if (filterChainId) {
      const subgraphUrl = DEFAULT_SUBGRAPH_URLS[filterChainId];
      if (!subgraphUrl) {
        return NextResponse.json(
          { error: `Chain ID ${filterChainId} is not supported` },
          { status: 400 }
        );
      }
      chainsToQuery = [[filterChainId.toString(), subgraphUrl]];
    } else {
      chainsToQuery = Object.entries(DEFAULT_SUBGRAPH_URLS);
    }

    // Query chains in parallel
    const chainQueries = chainsToQuery.map(async ([chainIdStr, subgraphUrl]) => {
      const chainId = parseInt(chainIdStr, 10);
      
      if (!subgraphUrl) {
        console.error(`No subgraph URL found for chain ${chainId}`);
        return [];
      }
      
      // Use pagination to get more results if needed
      let allAgents: SubgraphAgent[] = [];
      let skip = 0;
      const pageSize = 1000; // Max per query
      let hasMore = true;

      while (hasMore && allAgents.length < limit) {
        // When filtering by chain, also filter in the query itself
        const query = filterChainId
          ? `
            query GetRecentAgents($first: Int!, $skip: Int!, $chainId: BigInt!) {
              agents(
                where: { chainId: $chainId }
                orderBy: createdAt
                orderDirection: desc
                first: $first
                skip: $skip
              ) {
                id
                chainId
                agentId
                agentURI
                createdAt
                registrationFile {
                  name
                  description
                  image
                  active
                }
              }
            }
          `
          : `
            query GetRecentAgents($first: Int!, $skip: Int!) {
              agents(
                orderBy: createdAt
                orderDirection: desc
                first: $first
                skip: $skip
              ) {
                id
                chainId
                agentId
                agentURI
                createdAt
                registrationFile {
                  name
                  description
                  image
                  active
                }
              }
            }
          `;

        try {
          const variables = filterChainId
            ? {
                first: Math.min(pageSize, limit - allAgents.length),
                skip,
                chainId: filterChainId.toString(),
              }
            : {
                first: Math.min(pageSize, limit - allAgents.length),
                skip,
              };

          const data = await querySubgraph(subgraphUrl, query, variables) as { agents: SubgraphAgent[] };

          // Include agents even if they don't have registration files (use defaults)
          const agents = (data.agents || []).map(a => ({
            ...a,
            registrationFile: a.registrationFile || {
              name: `Agent #${a.agentId}`,
              description: `Agent ${a.agentId} on chain ${chainId}`,
              image: undefined,
              active: false,
            },
          }));
          allAgents = [...allAgents, ...agents];
          
          // If we got fewer than requested, we've reached the end
          hasMore = agents.length === pageSize && allAgents.length < limit;
          skip += pageSize;
        } catch (error) {
          console.error(`Error querying chain ${chainId}:`, error);
          // Log more details for debugging
          if (error instanceof Error) {
            console.error(`Error message: ${error.message}`);
          }
          hasMore = false;
        }
      }

      return allAgents
        .slice(0, limit)
        .map(a => {
          const regFile = a.registrationFile || {
            name: `Agent #${a.agentId}`,
            description: `Agent ${a.agentId} on chain ${chainId}`,
            image: undefined,
            active: false,
          };
          return {
            agentId: a.id,
            chainId,
            name: regFile.name || `Agent #${a.agentId}`,
            image: regFile.image,
            description: regFile.description || '',
            createdAt: a.createdAt,
            active: regFile.active ?? false,
            agentURI: a.agentURI || undefined,
          };
        });
    });

    const allAgents = (await Promise.all(chainQueries)).flat();
    
    // Sort by creation date (newest first) and limit
    const recentAgents = allAgents
      .sort((a, b) => parseInt(b.createdAt, 10) - parseInt(a.createdAt, 10))
      .slice(0, limit)
      .map(agent => ({
        agentId: agent.agentId,
        chainId: agent.chainId,
        name: agent.name,
        image: agent.image,
        description: agent.description,
        createdAt: new Date(parseInt(agent.createdAt, 10) * 1000).toISOString(),
        active: agent.active,
        agentURI: agent.agentURI,
      }));

    return NextResponse.json({ agents: recentAgents });
  } catch (error) {
    console.error('Recent agents API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recent agents' },
      { status: 500 }
    );
  }
}

