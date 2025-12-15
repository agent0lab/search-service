/**
 * Capabilities discovery endpoint
 * Returns provider capabilities, limits, and supported features
 */
import type { Context } from 'hono';
import type { Env } from '../../types.js';
import type { CapabilitiesResponse } from '../../utils/standard-types.js';
import { MAX_QUERY_LENGTH, MAX_TOP_K } from '../../types.js';

// Supported filter fields from AgentRegistrationFile schema
const SUPPORTED_FILTERS = [
  'id',
  'cid',
  'agentId',
  'name',
  'description',
  'image',
  'active',
  'x402support',
  'supportedTrusts',
  'mcpEndpoint',
  'mcpVersion',
  'a2aEndpoint',
  'a2aVersion',
  'ens',
  'did',
  'agentWallet',
  'agentWalletChainId',
  'mcpTools',
  'mcpPrompts',
  'mcpResources',
  'a2aSkills',
  'chainId',
  'createdAt',
  // Additional fields from current implementation
  'capabilities',
  'defaultInputModes',
  'defaultOutputModes',
  'tags',
];

const SUPPORTED_OPERATORS = ['equals', 'in', 'notIn', 'exists', 'notExists'];

const MAX_FILTERS = 50;
const MAX_REQUEST_SIZE = 1048576; // 1MB

export async function capabilitiesHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const capabilities: CapabilitiesResponse = {
    version: '1.0.0',
    limits: {
      maxQueryLength: MAX_QUERY_LENGTH,
      maxLimit: MAX_TOP_K,
      maxFilters: MAX_FILTERS,
      maxRequestSize: MAX_REQUEST_SIZE,
    },
    supportedFilters: SUPPORTED_FILTERS,
    supportedOperators: SUPPORTED_OPERATORS,
    features: {
      pagination: true,
      cursorPagination: true,
      metadataFiltering: true,
      scoreThreshold: true,
    },
  };

  return c.json(capabilities);
}


