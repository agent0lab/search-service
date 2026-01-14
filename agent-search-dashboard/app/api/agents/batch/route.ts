import { NextRequest, NextResponse } from 'next/server';
import { getSubgraphUrl } from '../../../lib/subgraph-endpoints';

interface BatchAgentRequest {
  agentIds: string[]; // Format: "chainId:tokenId"
}

interface AgentData {
  agentId: string;
  agentURI?: string;
  image?: string;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as BatchAgentRequest;
    
    if (!body.agentIds || !Array.isArray(body.agentIds) || body.agentIds.length === 0) {
      return NextResponse.json(
        { error: 'agentIds array is required' },
        { status: 400 }
      );
    }

    // Group agents by chainId
    const agentsByChain: Record<number, string[]> = {};
    for (const agentId of body.agentIds) {
      const [chainIdStr] = agentId.split(':');
      const chainId = parseInt(chainIdStr, 10);
      if (!isNaN(chainId)) {
        if (!agentsByChain[chainId]) {
          agentsByChain[chainId] = [];
        }
        agentsByChain[chainId].push(agentId);
      }
    }

    // Query each chain in parallel
    const chainQueries = Object.entries(agentsByChain).map(async ([chainIdStr, agentIds]) => {
      const chainId = parseInt(chainIdStr, 10);
      const subgraphUrl = getSubgraphUrl(chainId);
      
      if (!subgraphUrl) {
        console.error(`No subgraph URL found for chain ${chainId}`);
        return [];
      }

      // Build GraphQL query for multiple agents
      const agentIdList = agentIds.map(id => `"${id}"`).join(', ');
      const query = `
        query GetBatchAgentURIs {
          agents(
            where: { id_in: [${agentIdList}] }
          ) {
            id
            agentURI
            registrationFile {
              image
            }
          }
        }
      `;

      try {
        const data = await querySubgraph(subgraphUrl, query, {}) as { agents: Array<{ id: string; agentURI?: string; registrationFile?: { image?: string } | null }> };
        
        return (data.agents || []).map(agent => ({
          agentId: agent.id,
          agentURI: agent.agentURI || undefined,
          image: agent.registrationFile?.image || undefined,
        }));
      } catch (error) {
        console.error(`Error querying chain ${chainId}:`, error);
        return [];
      }
    });

    const allResults = (await Promise.all(chainQueries)).flat();
    
    // Create a map for quick lookup
    const resultMap: Record<string, AgentData> = {};
    for (const result of allResults) {
      resultMap[result.agentId] = result;
    }

    // Return results in the same order as requested
    const results = body.agentIds.map(agentId => resultMap[agentId] || { agentId });

    return NextResponse.json({ agents: results });
  } catch (error) {
    console.error('Batch agents API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch batch agents' },
      { status: 500 }
    );
  }
}

