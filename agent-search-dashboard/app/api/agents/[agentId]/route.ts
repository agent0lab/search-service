import { NextRequest, NextResponse } from 'next/server';
import { SDK } from 'agent0-sdk';
import { getSubgraphUrl } from '../../../../lib/subgraph-endpoints';

// RPC URLs for SDK initialization (read-only, no signer needed)
const RPC_URLS: Record<number, string> = {
  11155111: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Ethereum Sepolia
  84532: 'https://sepolia.base.org', // Base Sepolia
  80002: 'https://rpc-amoy.polygon.technology', // Polygon Amoy
};

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

    // Use centralized subgraph endpoints mapping
    const subgraphUrl = getSubgraphUrl(chainId);
    
    if (!subgraphUrl) {
      return NextResponse.json(
        { error: `No subgraph configured for chain ${chainId}` },
        { status: 400 }
      );
    }

    // SDK uses format "chainId:tokenId" (e.g., "84532:1062")
    const formattedAgentId = `${chainId}:${tokenIdStr}`;
    
    // Query subgraph directly (avoiding SDK's incompatible subgraph client in Workers)
    // Note: owners and operators are not available in the subgraph schema,
    // they would need to be fetched from the blockchain via RPC calls
    const agentQuery = `
      query GetAgent($agentId: String!) {
        agent(id: $agentId) {
          id
          chainId
          agentId
          agentURI
          registrationFile {
            name
            description
            image
            active
            mcpEndpoint
            a2aEndpoint
            mcpVersion
            a2aVersion
          }
        }
      }
    `;
    
    const subgraphData = await querySubgraph(subgraphUrl, agentQuery, { agentId: formattedAgentId }) as { 
      agent: { 
        id?: string;
        chainId?: string;
        agentId?: string;
        agentURI?: string;
        registrationFile?: { 
          name?: string;
          description?: string;
          image?: string;
          active?: boolean;
          mcpEndpoint?: string;
          a2aEndpoint?: string;
          mcpVersion?: string;
          a2aVersion?: string;
        } | null;
      } | null;
    };
    
    if (!subgraphData.agent) {
      return NextResponse.json(
        { error: `Agent ${agentId} not found` },
        { status: 404 }
      );
    }
    
    const agent = subgraphData.agent;
    const registrationFile = agent.registrationFile;
    const agentURI = agent.agentURI;
    const mcpEndpoint = registrationFile?.mcpEndpoint;
    const a2aEndpoint = registrationFile?.a2aEndpoint;
    
    // Build agent summary from subgraph data
    // Note: owners, operators, ens, did, walletAddress need to be fetched from blockchain via RPC
    // supportedTrusts, a2aSkills, mcpTools, etc. will be populated from registration file
    const agentSummary: AgentSummary = {
      chainId: parseInt(agent.chainId || chainId.toString(), 10),
      agentId: agent.agentId || formattedAgentId,
      name: registrationFile?.name || 'Unnamed Agent',
      image: registrationFile?.image,
      description: registrationFile?.description || '',
      owners: [], // Not available in subgraph, would need RPC call
      operators: [], // Not available in subgraph, would need RPC call
      mcp: !!mcpEndpoint,
      a2a: !!a2aEndpoint,
      ens: undefined, // Would need RPC call to resolve
      did: undefined, // Would need RPC call to resolve
      walletAddress: undefined, // Would need RPC call to resolve
      supportedTrusts: [], // Will be populated from registration file
      a2aSkills: [], // Will be populated from registration file
      mcpTools: [], // Will be populated from registration file
      mcpPrompts: [], // Will be populated from registration file
      mcpResources: [], // Will be populated from registration file
      active: registrationFile?.active ?? false,
      x402support: false, // Will be populated from registration file
      extras: {},
      mcpEndpoint,
      mcpVersion: registrationFile?.mcpVersion,
      a2aEndpoint,
      a2aVersion: registrationFile?.a2aVersion,
    };
    
    // Initialize SDK only for loadAgent (which uses fetch internally, not the subgraph client)
    // We avoid using sdk.getAgent() because it uses the SDK's subgraph client which has compatibility issues
    let sdk: SDK | null = null;
    try {
      const rpcUrl = RPC_URLS[chainId];
      sdk = new SDK({
        chainId: chainId as 11155111 | 84532 | 80002,
        rpcUrl: rpcUrl || 'https://eth.llamarpc.com', // Fallback RPC
        subgraphOverrides: { [chainId]: subgraphUrl } as Record<number, string>,
      });
    } catch (error) {
      console.warn('Failed to initialize SDK, will skip loadAgent:', error);
    }
    
    // Use SDK's loadAgent to fetch the registration file and potentially the agent card
    let agentCard = null;
    if (agentURI && sdk) {
      try {
        // Use SDK's loadAgent - it will handle IPFS, HTTP, etc. using HTTP gateways if IPFS not configured
        const agent = await sdk.loadAgent(formattedAgentId);
        
        // Check if the registration file has an agentCard in metadata
        // Use unknown first to safely access properties
        const agentUnknown = agent as unknown;
        const agentWithRegistration = agentUnknown as { registrationFile?: { metadata?: { agentCard?: unknown } } };
        const registrationFile = agentWithRegistration.registrationFile;
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
                } catch {
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
      skills: (response.agentCard as { skills?: unknown[] })?.skills?.length || 0,
      capabilities: !!(response.agentCard as { capabilities?: unknown })?.capabilities,
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

