// Type aliases for semantic search
export type AgentId = string; // Format: "chainId:tokenId" (e.g., "8453:1234")
export type ChainId = number; // Chain ID (numeric)

export interface SemanticAgentRecord {
  chainId: ChainId;
  agentId: AgentId;
  name: string;
  description: string;
  capabilities?: string[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SemanticSearchFilters {
  capabilities?: string[];
  defaultInputMode?: string;
  defaultOutputMode?: string;
  minScore?: number;
  [key: string]: unknown;
}

