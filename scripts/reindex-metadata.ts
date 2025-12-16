#!/usr/bin/env node
/**
 * Reindex metadata script - Updates existing Pinecone vectors with new metadata fields
 * 
 * This script updates existing vectors in Pinecone with new metadata fields:
 * - owner, operators (from Agent level)
 * - mcpEndpoint, a2aEndpoint, mcpVersion, a2aVersion (from registrationFile)
 * - mcp, a2a (derived boolean fields)
 * - createdAt (from Agent level)
 * 
 * Usage:
 *   1. Ensure .dev.vars has all required secrets
 *   2. Run: npx tsx scripts/reindex-metadata.ts [options]
 * 
 * Options:
 *   --chain-id <id>     Reindex specific chain only (e.g., 11155111)
 *   --dry-run           Show what would be updated without making changes
 *   --batch-size <n>    Number of vectors to process per batch (default: 10)
 *   --limit <n>         Maximum number of vectors to process (for testing)
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pinecone } from '@pinecone-database/pinecone';

// Load .dev.vars
function loadDevVars(): Record<string, string> {
  const devVarsPath = join(process.cwd(), '.dev.vars');
  try {
    const content = readFileSync(devVarsPath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          acc[key.trim()] = valueParts.join('=').trim();
        }
        return acc;
      }, {} as Record<string, string>);
  } catch (error) {
    throw new Error(`Failed to load .dev.vars: ${error}`);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    chainId?: number;
    dryRun: boolean;
    batchSize: number;
    limit?: number;
  } = {
    dryRun: false,
    batchSize: 10,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--chain-id' && args[i + 1]) {
      options.chainId = Number(args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      options.batchSize = Number(args[i + 1]);
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = Number(args[i + 1]);
      i++;
    }
  }

  return options;
}

// Query subgraph for agent data
async function fetchAgentFromSubgraph(
  subgraphUrl: string,
  agentId: string
): Promise<{
  owner?: string;
  operators?: string[];
  createdAt?: string;
  registrationFile?: {
    mcpEndpoint?: string;
    mcpVersion?: string;
    a2aEndpoint?: string;
    a2aVersion?: string;
  };
} | null> {
  const query = `
    query GetAgent($agentId: ID!) {
      agent(id: $agentId) {
        owner
        operators
        createdAt
        registrationFile {
          mcpEndpoint
          mcpVersion
          a2aEndpoint
          a2aVersion
        }
      }
    }
  `;

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { agentId } }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as {
      data?: { agent?: any };
      errors?: Array<{ message: string }>;
    };

    if (result.errors || !result.data?.agent) {
      return null;
    }

    return result.data.agent;
  } catch (error) {
    console.error(`Error fetching agent ${agentId}:`, error);
    return null;
  }
}

// Get subgraph URL for chain
function getSubgraphUrl(chainId: number): string {
  const defaultSubgraphs: Record<number, string> = {
    11155111: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT',
    84532: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/GjQEDgEKqoh5Yc8MUgxoQoRATEJdEiH7HbocfR1aFiHa',
    80002: 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/2A1JB18r1mF2VNP4QBH4mmxd74kbHoM6xLXC8ABAKf7j',
  };

  return defaultSubgraphs[chainId] || '';
}

// Parse vector ID to extract chainId and agentId
function parseVectorId(vectorId: string): { chainId: number; agentId: string } | null {
  const separatorIndex = vectorId.indexOf('-');
  if (separatorIndex === -1) {
    return null;
  }

  const chainIdPart = vectorId.slice(0, separatorIndex);
  const agentIdPart = vectorId.slice(separatorIndex + 1);
  const chainId = Number(chainIdPart);

  if (Number.isNaN(chainId)) {
    return null;
  }

  return { chainId, agentId: agentIdPart };
}

async function reindexMetadata() {
  console.log('🔄 Starting metadata reindexing...\n');

  const options = parseArgs();
  const devVars = loadDevVars();

  // Validate required env vars
  const required = ['PINECONE_API_KEY', 'PINECONE_INDEX', 'RPC_URL'];
  for (const key of required) {
    if (!devVars[key] && !process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    if (!process.env[key]) {
      process.env[key] = devVars[key];
    }
  }

  const pineconeApiKey = process.env.PINECONE_API_KEY!;
  const pineconeIndex = process.env.PINECONE_INDEX!;
  const pineconeNamespace = process.env.PINECONE_NAMESPACE;

  console.log('📋 Configuration:');
  console.log(`   - Pinecone Index: ${pineconeIndex}`);
  if (pineconeNamespace) {
    console.log(`   - Pinecone Namespace: ${pineconeNamespace}`);
  }
  if (options.chainId) {
    console.log(`   - Chain ID: ${options.chainId}`);
  }
  console.log(`   - Batch Size: ${options.batchSize}`);
  console.log(`   - Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
  if (options.limit) {
    console.log(`   - Limit: ${options.limit} vectors`);
  }
  console.log('');

  // Initialize Pinecone
  const pinecone = new Pinecone({ apiKey: pineconeApiKey });
  const index = pineconeNamespace
    ? pinecone.index(pineconeIndex).namespace(pineconeNamespace)
    : pinecone.index(pineconeIndex);

  // Query all vectors (or filter by chainId if specified)
  console.log('📡 Fetching vectors from Pinecone...');
  let totalVectors = 0;
  let processedVectors = 0;
  let updatedVectors = 0;
  let skippedVectors = 0;
  let errorVectors = 0;

  try {
    // Use listPaginated to get all vector IDs
    // Note: Pinecone doesn't have a direct "list all" API, so we'll need to query by metadata
    // For now, we'll use a workaround: query with a dummy vector to get matches, then process them
    
    // Get stats to understand the index
    const stats = await index.describeIndexStats();
    console.log(`   Total vectors in index: ${stats.totalRecordCount || 'unknown'}\n`);

    // Since we can't list all vectors directly, we'll need to query with a very generic query
    // or use the SDK's approach. For now, let's use a different strategy:
    // Query with an empty filter to get all vectors (but this might not work)
    
    // Alternative: Use the subgraph to get all agent IDs, then check which ones exist in Pinecone
    // This is more efficient but requires subgraph access
    
    console.log('⚠️  Note: Pinecone doesn\'t support listing all vectors directly.');
    console.log('   This script requires either:');
    console.log('   1. A list of agent IDs to reindex');
    console.log('   2. Querying the subgraph for all agents and checking Pinecone');
    console.log('');
    console.log('   For now, this script will query vectors by fetching from subgraph.');
    console.log('   Please provide a chain ID to reindex specific chain.\n');

    if (!options.chainId) {
      console.error('❌ Error: --chain-id is required for reindexing');
      console.error('   Example: npx tsx scripts/reindex-metadata.ts --chain-id 11155111');
      process.exit(1);
    }

    const chainId = options.chainId;
    const subgraphUrl = getSubgraphUrl(chainId);

    if (!subgraphUrl) {
      console.error(`❌ Error: No subgraph URL configured for chain ${chainId}`);
      process.exit(1);
    }

    console.log(`📡 Fetching agents from subgraph (chain ${chainId})...`);
    
    // Fetch all agents using pagination (The Graph has a limit of 1000 per query)
    const allAgents: Array<{
      id: string;
      owner?: string;
      operators?: string[];
      createdAt?: string;
      registrationFile?: {
        mcpEndpoint?: string;
        mcpVersion?: string;
        a2aEndpoint?: string;
        a2aVersion?: string;
      };
    }> = [];

    const batchSize = 1000; // The Graph limit
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const query = `
        query GetAllAgents($skip: Int!, $first: Int!) {
          agents(
            first: $first
            skip: $skip
            where: { registrationFile_not: null }
            orderBy: id
            orderDirection: asc
          ) {
            id
            owner
            operators
            createdAt
            registrationFile {
              mcpEndpoint
              mcpVersion
              a2aEndpoint
              a2aVersion
            }
          }
        }
      `;

      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query, 
          variables: { skip, first: batchSize } 
        }),
      });

      if (!response.ok) {
        throw new Error(`Subgraph query failed: ${response.statusText}`);
      }

      const result = await response.json() as {
        data?: { agents?: Array<{
          id: string;
          owner?: string;
          operators?: string[];
          createdAt?: string;
          registrationFile?: {
            mcpEndpoint?: string;
            mcpVersion?: string;
            a2aEndpoint?: string;
            a2aVersion?: string;
          };
        }> };
        errors?: Array<{ message: string }>;
      };

      if (result.errors) {
        throw new Error(`Subgraph errors: ${result.errors.map(e => e.message).join(', ')}`);
      }

      const agents = result.data?.agents || [];
      
      if (agents.length === 0) {
        hasMore = false;
      } else {
        allAgents.push(...agents);
        console.log(`   Fetched ${allAgents.length} agents so far...`);
        
        // If we got fewer than batchSize, we've reached the end
        if (agents.length < batchSize) {
          hasMore = false;
        } else {
          skip += batchSize;
        }
      }
    }

    const agents = allAgents;
    console.log(`   Found ${agents.length} total agents in subgraph\n`);

    if (agents.length === 0) {
      console.log('✅ No agents to reindex');
      return;
    }

    // Process agents in batches
    const batches = [];
    for (let i = 0; i < agents.length; i += options.batchSize) {
      batches.push(agents.slice(i, i + options.batchSize));
    }

    if (options.limit) {
      const limitedBatches = [];
      let count = 0;
      for (const batch of batches) {
        if (count >= options.limit) break;
        limitedBatches.push(batch.slice(0, options.limit - count));
        count += batch.length;
      }
      batches.splice(0, batches.length, ...limitedBatches);
    }

    console.log(`🔄 Processing ${agents.length} agents in ${batches.length} batches...\n`);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`📦 Batch ${batchIdx + 1}/${batches.length} (${batch.length} agents)...`);

      const updates: Array<{
        id: string;
        values?: number[];
        metadata: Record<string, unknown>;
      }> = [];

      for (const agent of batch) {
        const vectorId = `${chainId}-${agent.id}`;
        totalVectors++;

        try {
          // Fetch current vector from Pinecone
          const fetchResult = await index.fetch([vectorId]);
          const vector = fetchResult.records?.[vectorId];

          if (!vector) {
            console.log(`   ⚠️  Vector ${vectorId} not found in Pinecone, skipping`);
            skippedVectors++;
            continue;
          }

          // Calculate new metadata
          const hasMcpEndpoint = !!(agent.registrationFile?.mcpEndpoint && agent.registrationFile.mcpEndpoint.trim() !== '');
          const hasA2aEndpoint = !!(agent.registrationFile?.a2aEndpoint && agent.registrationFile.a2aEndpoint.trim() !== '');

          const newMetadata: Record<string, unknown> = {
            ...vector.metadata,
            owner: agent.owner ?? undefined,
            operators: agent.operators ?? undefined,
            createdAt: agent.createdAt ?? undefined,
            mcpEndpoint: agent.registrationFile?.mcpEndpoint ?? undefined,
            mcpVersion: agent.registrationFile?.mcpVersion ?? undefined,
            a2aEndpoint: agent.registrationFile?.a2aEndpoint ?? undefined,
            a2aVersion: agent.registrationFile?.a2aVersion ?? undefined,
            mcp: hasMcpEndpoint,
            a2a: hasA2aEndpoint,
          };

          // Check if metadata actually changed
          const metadataChanged = JSON.stringify(vector.metadata) !== JSON.stringify(newMetadata);

          if (!metadataChanged) {
            skippedVectors++;
            continue;
          }

          if (options.dryRun) {
            console.log(`   🔍 Would update ${vectorId}`);
            console.log(`      New fields: owner=${!!newMetadata.owner}, operators=${!!newMetadata.operators}, mcp=${newMetadata.mcp}, a2a=${newMetadata.a2a}`);
            updatedVectors++;
          } else {
            updates.push({
              id: vectorId,
              values: vector.values, // Preserve existing embedding
              metadata: newMetadata,
            });
          }
        } catch (error) {
          console.error(`   ❌ Error processing ${vectorId}:`, error);
          errorVectors++;
        }
      }

      // Upsert batch if not dry-run
      if (!options.dryRun && updates.length > 0) {
        try {
          await index.upsert(updates);
          updatedVectors += updates.length;
          processedVectors += batch.length;
          console.log(`   ✅ Updated ${updates.length} vectors`);
        } catch (error) {
          console.error(`   ❌ Error upserting batch:`, error);
          errorVectors += updates.length;
        }
      } else {
        processedVectors += batch.length;
      }
    }

    console.log('\n✅ Reindexing complete!');
    console.log(`   Total vectors processed: ${processedVectors}`);
    console.log(`   Updated: ${updatedVectors}`);
    console.log(`   Skipped (no changes): ${skippedVectors}`);
    console.log(`   Errors: ${errorVectors}`);
  } catch (error) {
    console.error('\n❌ Reindexing failed:', error);
    process.exit(1);
  }
}

// Run the script
reindexMetadata().catch(error => {
  console.error('\n❌ Reindex script failed:', error);
  process.exit(1);
});

