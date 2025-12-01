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
    active: boolean;
    mcpEndpoint?: string;
    a2aEndpoint?: string;
  } | null;
}

interface StatsResponse {
  totalAgents: number;
  activeAgents: number;
  agentsByChain: Record<number, number>;
  recentRegistrations24h: number;
  recentRegistrations7d: number;
  mcpEnabled: number;
  a2aEnabled: number;
}

async function querySubgraph(subgraphUrl: string, query: string, variables: Record<string, unknown>): Promise<unknown> {
  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { data?: unknown; errors?: Array<{ message: string }> };

    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return result.data;
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Subgraph request timed out after 15 seconds: ${subgraphUrl}`);
    }
    if (error instanceof Error && error.message.includes('fetch failed')) {
      throw new Error(`Failed to connect to subgraph: ${subgraphUrl}. ${error.message}`);
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats: StatsResponse = {
      totalAgents: 0,
      activeAgents: 0,
      agentsByChain: {},
      recentRegistrations24h: 0,
      recentRegistrations7d: 0,
      mcpEnabled: 0,
      a2aEnabled: 0,
    };

    const now = Math.floor(Date.now() / 1000);
    const day24hAgo = now - (24 * 60 * 60);
    const day7dAgo = now - (7 * 24 * 60 * 60);

    // Query all chains in parallel
    const chainQueries = Object.entries(DEFAULT_SUBGRAPH_URLS).map(async ([chainIdStr, subgraphUrl]) => {
      const chainId = parseInt(chainIdStr, 10);
      
      // First, try to get total count using pagination
      // The Graph typically limits to 1000 per query, so we'll paginate
      let allAgents: SubgraphAgent[] = [];
      let skip = 0;
      const pageSize = 1000;
      let hasMore = true;

      try {
        // Paginate through all agents
        while (hasMore) {
          const query = `
            query GetStats($skip: Int!, $first: Int!) {
              agents(first: $first, skip: $skip) {
                id
                chainId
                createdAt
                registrationFile {
                  active
                  mcpEndpoint
                  a2aEndpoint
                }
              }
            }
          `;

          const data = await querySubgraph(subgraphUrl, query, {
            skip,
            first: pageSize,
          }) as { agents: SubgraphAgent[] };

          const agents = data.agents || [];
          allAgents = [...allAgents, ...agents];
          
          // If we got fewer than pageSize, we've reached the end
          hasMore = agents.length === pageSize;
          skip += pageSize;
        }
        
        return {
          chainId,
          total: allAgents.length,
          active: allAgents.filter(a => a.registrationFile?.active).length,
          recent24h: allAgents.filter(a => {
            const createdAt = parseInt(a.createdAt, 10);
            return createdAt >= day24hAgo;
          }).length,
          recent7d: allAgents.filter(a => {
            const createdAt = parseInt(a.createdAt, 10);
            return createdAt >= day7dAgo;
          }).length,
          mcp: allAgents.filter(a => !!a.registrationFile?.mcpEndpoint).length,
          a2a: allAgents.filter(a => !!a.registrationFile?.a2aEndpoint).length,
        };
      } catch (error) {
        console.error(`Error querying chain ${chainId}:`, error);
        return {
          chainId,
          total: 0,
          active: 0,
          recent24h: 0,
          recent7d: 0,
          mcp: 0,
          a2a: 0,
        };
      }
    });

    const chainResults = await Promise.all(chainQueries);

    // Aggregate results
    chainResults.forEach((result) => {
      stats.totalAgents += result.total;
      stats.activeAgents += result.active;
      stats.agentsByChain[result.chainId] = result.total;
      stats.recentRegistrations24h += result.recent24h;
      stats.recentRegistrations7d += result.recent7d;
      stats.mcpEnabled += result.mcp;
      stats.a2aEnabled += result.a2a;
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

