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
  owner: string;
  operators: string[];
  agentURI?: string;
  createdAt: string;
  updatedAt: string;
  registrationFile?: {
    id: string;
    agentId: string;
    name: string;
    description: string;
    image?: string;
    active: boolean;
    x402support: boolean;
    supportedTrusts: string[];
    mcpEndpoint?: string;
    mcpVersion?: string;
    a2aEndpoint?: string;
    a2aVersion?: string;
    ens?: string;
    did?: string;
    agentWallet?: string;
    agentWalletChainId?: number;
    mcpTools: string[];
    mcpPrompts: string[];
    mcpResources: string[];
    a2aSkills: string[];
  };
}

interface AgentSummary {
  chainId: number;
  agentId: string;
  name: string;
  image?: string;
  description: string;
  owners: string[];
  operators: string[];
  mcp: boolean;
  a2a: boolean;
  ens?: string;
  did?: string;
  walletAddress?: string;
  supportedTrusts: string[];
  a2aSkills: string[];
  mcpTools: string[];
  mcpPrompts: string[];
  mcpResources: string[];
  active: boolean;
  x402support: boolean;
  extras: Record<string, unknown>;
  // Extended fields from registration file
  mcpEndpoint?: string;
  mcpVersion?: string;
  a2aEndpoint?: string;
  a2aVersion?: string;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function transformAgent(agent: SubgraphAgent): AgentSummary {
  const chainId = parseInt(agent.chainId || '0', 10);
  const agentIdStr = agent.id || `${chainId}:${agent.agentId || '0'}`;
  const regFile = agent.registrationFile;
  const operators = (agent.operators || []).map((op: string) => 
    typeof op === 'string' ? normalizeAddress(op) : op
  );

  return {
    chainId,
    agentId: agentIdStr,
    name: regFile?.name || '',
    image: regFile?.image || undefined,
    description: regFile?.description || '',
    owners: agent.owner ? [normalizeAddress(agent.owner)] : [],
    operators,
    mcp: !!regFile?.mcpEndpoint,
    a2a: !!regFile?.a2aEndpoint,
    ens: regFile?.ens || undefined,
    did: regFile?.did || undefined,
    walletAddress: regFile?.agentWallet ? normalizeAddress(regFile.agentWallet) : undefined,
    supportedTrusts: regFile?.supportedTrusts || [],
    a2aSkills: regFile?.a2aSkills || [],
    mcpTools: regFile?.mcpTools || [],
    mcpPrompts: regFile?.mcpPrompts || [],
    mcpResources: regFile?.mcpResources || [],
    active: regFile?.active ?? false,
    x402support: regFile?.x402support ?? false,
    extras: {},
    // Include endpoint details
    mcpEndpoint: regFile?.mcpEndpoint || undefined,
    mcpVersion: regFile?.mcpVersion || undefined,
    a2aEndpoint: regFile?.a2aEndpoint || undefined,
    a2aVersion: regFile?.a2aVersion || undefined,
  };
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId: rawAgentId } = await params;
    
    // Decode the agentId in case it's URL-encoded (e.g., %3A becomes :)
    const agentId = decodeURIComponent(rawAgentId);

    // Parse agentId (format: "chainId:tokenId")
    const [chainIdStr, tokenIdStr] = agentId.split(':');
    const chainId = parseInt(chainIdStr, 10);

    if (Number.isNaN(chainId) || !tokenIdStr) {
      return NextResponse.json(
        { error: `Invalid agent ID format: ${agentId}. Expected format: chainId:tokenId` },
        { status: 400 }
      );
    }

    // Get subgraph URL for this chain
    const subgraphUrl = DEFAULT_SUBGRAPH_URLS[chainId];
    if (!subgraphUrl) {
      return NextResponse.json(
        { error: `No subgraph configured for chain ${chainId}` },
        { status: 400 }
      );
    }

    // SDK uses format "chainId:tokenId" (e.g., "84532:1062")
    // Pass it directly to the subgraph query as the SDK does
    const formattedAgentId = `${chainId}:${tokenIdStr}`;
    
    // GraphQL query matching the SDK's implementation exactly
    const query = `
      query GetAgent($agentId: String!) {
        agent(id: $agentId) {
          id
          chainId
          agentId
          owner
          operators
          agentURI
          createdAt
          updatedAt
          registrationFile {
            id
            agentId
            name
            description
            image
            active
            x402support
            supportedTrusts
            mcpEndpoint
            mcpVersion
            a2aEndpoint
            a2aVersion
            ens
            did
            agentWallet
            agentWalletChainId
            mcpTools
            mcpPrompts
            mcpResources
            a2aSkills
          }
        }
      }
    `;

    const variables = { agentId: formattedAgentId };
    let data = await querySubgraph(subgraphUrl, query, variables) as { agent: SubgraphAgent | null };

    // Fallback: if not found by id, try querying by chainId and agentId fields
    if (!data.agent) {
      const queryByFields = `
        query GetAgentByFields($chainId: BigInt!, $tokenId: BigInt!) {
          agents(
            where: { chainId: $chainId, agentId: $tokenId }
            first: 1
          ) {
            id
            chainId
            agentId
            owner
            operators
            agentURI
            createdAt
            updatedAt
            registrationFile {
              id
              agentId
              name
              description
              image
              active
              x402support
              supportedTrusts
              mcpEndpoint
              mcpVersion
              a2aEndpoint
              a2aVersion
              ens
              did
              agentWallet
              agentWalletChainId
              mcpTools
              mcpPrompts
              mcpResources
              a2aSkills
            }
          }
        }
      `;
      
      const fieldVariables = {
        chainId: chainId.toString(),
        tokenId: tokenIdStr,
      };
      
      const fieldData = await querySubgraph(subgraphUrl, queryByFields, fieldVariables) as { agents: SubgraphAgent[] };
      
      if (fieldData.agents && fieldData.agents.length > 0) {
        data = { agent: fieldData.agents[0] };
      }
    }

    if (!data.agent) {
      return NextResponse.json(
        { error: `Agent ${agentId} not found` },
        { status: 404 }
      );
    }

    const agentSummary = transformAgent(data.agent);
    return NextResponse.json(agentSummary);
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

