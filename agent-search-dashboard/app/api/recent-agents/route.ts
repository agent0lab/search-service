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
  createdAt: string;
  registrationFile?: {
    name: string;
    description: string;
    image?: string;
    active: boolean;
  } | null;
}

interface RecentAgent {
  agentId: string;
  chainId: number;
  name: string;
  image?: string;
  description: string;
  createdAt: string;
  active: boolean;
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
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '12', 10);

    // Query all chains in parallel
    const chainQueries = Object.entries(DEFAULT_SUBGRAPH_URLS).map(async ([chainIdStr, subgraphUrl]) => {
      const chainId = parseInt(chainIdStr, 10);
      
      const query = `
        query GetRecentAgents($first: Int!) {
          agents(
            orderBy: createdAt
            orderDirection: desc
            first: $first
          ) {
            id
            chainId
            agentId
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
        const data = await querySubgraph(subgraphUrl, query, {
          first: limit,
        }) as { agents: SubgraphAgent[] };

        const agents = (data.agents || [])
          .filter(a => a.registrationFile) // Only agents with registration files
          .map(a => ({
            agentId: a.id,
            chainId,
            name: a.registrationFile?.name || `Agent #${a.agentId}`,
            image: a.registrationFile?.image,
            description: a.registrationFile?.description || '',
            createdAt: a.createdAt,
            active: a.registrationFile?.active ?? false,
          }));

        return agents;
      } catch (error) {
        console.error(`Error querying chain ${chainId}:`, error);
        return [];
      }
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

