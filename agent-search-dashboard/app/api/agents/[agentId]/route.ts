import { NextRequest, NextResponse } from 'next/server';
import { SDK } from 'agent0-sdk';

// Default subgraph URLs (matching agent0-sdk)
const DEFAULT_SUBGRAPH_URLS: Record<number, string> = {
  11155111: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT', // Ethereum Sepolia
  84532: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/GjQEDgEKqoh5Yc8MUgxoQoRATEJdEiH7HbocfR1aFiHa', // Base Sepolia
  80002: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/2A1JB18r1mF2VNP4QBH4mmxd74kbHoM6xLXC8ABAKf7j', // Polygon Amoy
};

// RPC URLs for SDK initialization (read-only, no signer needed)
const RPC_URLS: Record<number, string> = {
  11155111: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Ethereum Sepolia
  84532: 'https://sepolia.base.org', // Base Sepolia
  80002: 'https://rpc-amoy.polygon.technology', // Polygon Amoy
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

    // Use SDK to get agent data
    const rpcUrl = RPC_URLS[chainId];
    const subgraphUrl = DEFAULT_SUBGRAPH_URLS[chainId];
    
    if (!subgraphUrl) {
      return NextResponse.json(
        { error: `No subgraph configured for chain ${chainId}` },
        { status: 400 }
      );
    }

    // Initialize SDK (read-only, no signer needed)
    // SDK will use HTTP gateways for IPFS URIs if IPFS is not configured
    const sdk = new SDK({
      chainId: chainId as any,
      rpcUrl: rpcUrl || 'https://eth.llamarpc.com', // Fallback RPC
      subgraphOverrides: { [chainId]: subgraphUrl } as any,
    });

    // SDK uses format "chainId:tokenId" (e.g., "84532:1062")
    const formattedAgentId = `${chainId}:${tokenIdStr}`;
    
    // Get agent summary from SDK
    const sdkAgentSummary = await sdk.getAgent(formattedAgentId);
    
    if (!sdkAgentSummary) {
      return NextResponse.json(
        { error: `Agent ${agentId} not found` },
        { status: 404 }
      );
    }

    // Transform SDK AgentSummary to our format
    const agentSummary: AgentSummary = {
      chainId: sdkAgentSummary.chainId,
      agentId: sdkAgentSummary.agentId,
      name: sdkAgentSummary.name,
      image: sdkAgentSummary.image,
      description: sdkAgentSummary.description,
      owners: sdkAgentSummary.owners,
      operators: sdkAgentSummary.operators,
      mcp: sdkAgentSummary.mcp,
      a2a: sdkAgentSummary.a2a,
      ens: sdkAgentSummary.ens,
      did: sdkAgentSummary.did,
      walletAddress: sdkAgentSummary.walletAddress,
      supportedTrusts: sdkAgentSummary.supportedTrusts,
      a2aSkills: sdkAgentSummary.a2aSkills,
      mcpTools: sdkAgentSummary.mcpTools,
      mcpPrompts: sdkAgentSummary.mcpPrompts,
      mcpResources: sdkAgentSummary.mcpResources,
      active: sdkAgentSummary.active,
      x402support: sdkAgentSummary.x402support,
      extras: sdkAgentSummary.extras,
    };

    // Get agentURI and endpoints from SDK's subgraph client
    // Since SDK's getAgent doesn't return agentURI, we'll use the SDK's subgraph client
    const subgraphClient = sdk.subgraphClient;
    if (!subgraphClient) {
      return NextResponse.json(
        { error: 'Subgraph client not available' },
        { status: 500 }
      );
    }
    
    // Use SDK's subgraph client to query for agentURI and endpoints
    const subgraphQuery = `
      query GetAgentURI($agentId: String!) {
        agent(id: $agentId) {
          agentURI
          registrationFile {
            mcpEndpoint
            a2aEndpoint
          }
        }
      }
    `;
    const subgraphData = await querySubgraph(subgraphUrl, subgraphQuery, { agentId: formattedAgentId }) as { agent: { agentURI?: string; registrationFile?: { mcpEndpoint?: string; a2aEndpoint?: string } } | null };
    const agentURI = subgraphData.agent?.agentURI;
    const mcpEndpoint = subgraphData.agent?.registrationFile?.mcpEndpoint;
    const a2aEndpoint = subgraphData.agent?.registrationFile?.a2aEndpoint;
    
    // Use SDK's loadAgent to fetch the registration file and potentially the agent card
    let agentCard = null;
    if (agentURI) {
      try {
        // Use SDK's loadAgent - it will handle IPFS, HTTP, etc. using HTTP gateways if IPFS not configured
        const agent = await sdk.loadAgent(formattedAgentId);
        
        // Check if the registration file has an agentCard in metadata
        const registrationFile = (agent as any).registrationFile;
        if (registrationFile?.metadata?.agentCard) {
          agentCard = registrationFile.metadata.agentCard;
          console.log('Found agentCard in registration file metadata');
        } else {
          // Try fetching agent card from endpoints
          const endpoints = [mcpEndpoint, a2aEndpoint].filter(Boolean) as string[];
          
          for (const endpoint of endpoints) {
            try {
              const endpointUrl = new URL(endpoint);
              const agentCardUrls = [
                `${endpointUrl.origin}/.well-known/agent-card.json`,
                `${endpoint}/.well-known/agent-card.json`,
                `${endpoint}/agentcard.json`,
              ];
              
              for (const agentCardUrl of agentCardUrls) {
                try {
                  const response = await fetch(agentCardUrl, {
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000),
                  });
                  if (response.ok) {
                    const cardData = await response.json() as unknown;
                    if (cardData && typeof cardData === 'object') {
                      const keys = Object.keys(cardData);
                      const isAgentCard = keys.includes('skills') || keys.includes('capabilities') || keys.includes('protocolVersion');
                      if (isAgentCard) {
                        agentCard = cardData;
                        console.log(`Successfully fetched agent card from: ${agentCardUrl}`);
                        break;
                      }
                    }
                  }
                } catch (err) {
                  continue;
                }
              }
              
              if (agentCard) break;
            } catch (err) {
              console.log('Error fetching from endpoint:', err);
            }
          }
          
          // If still no agent card, try fetching from agentURI domain
          if (!agentCard && (agentURI.startsWith('http://') || agentURI.startsWith('https://'))) {
            try {
              const url = new URL(agentURI);
              const wellKnownUrl = `${url.origin}/.well-known/agent-card.json`;
              const response = await fetch(wellKnownUrl, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000),
              });
              if (response.ok) {
                const cardData = await response.json() as unknown;
                if (cardData && typeof cardData === 'object') {
                  const keys = Object.keys(cardData);
                  const isAgentCard = keys.includes('skills') || keys.includes('capabilities') || keys.includes('protocolVersion');
                  if (isAgentCard) {
                    agentCard = cardData;
                    console.log('Successfully fetched agent card from agentURI domain');
                  }
                }
              }
            } catch (err) {
              console.log('Error fetching from agentURI domain:', err);
            }
          }
        }
      } catch (error) {
        // Log error for debugging
        console.error(`Failed to fetch agentCard using SDK from ${agentURI}:`, error);
        if (error instanceof Error) {
          console.error(`Error message: ${error.message}`);
        }
      }
    }
    
    // Final validation - ensure agentCard has the expected structure
    if (agentCard && typeof agentCard === 'object') {
      const keys = Object.keys(agentCard);
      const hasAgentCardStructure = keys.includes('skills') || keys.includes('capabilities') || keys.includes('protocolVersion');
      const isRegistrationFile = keys.includes('type') || keys.includes('endpoints') || keys.includes('registrations');
      
      if (isRegistrationFile && !hasAgentCardStructure) {
        console.log('Rejecting agentCard - appears to be registration file data');
        agentCard = null;
      }
    }
    
    const response = {
      ...agentSummary,
      agentURI: agentURI || undefined,
      agentCard: agentCard || undefined, // Only include if not null
    };
    
    console.log('Returning agent data:', {
      hasAgentCard: !!response.agentCard,
      agentCardKeys: response.agentCard ? Object.keys(response.agentCard) : [],
      skills: (response.agentCard as any)?.skills?.length || 0,
      capabilities: !!(response.agentCard as any)?.capabilities,
      agentURI: response.agentURI,
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

