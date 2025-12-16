'use client';

import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiquidEtherBackground } from '@/components/LiquidEtherBackground';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState } from 'react';

const API_ENDPOINT = 'https://agent0-semantic-search.dawid-pisarczyk.workers.dev/api/v1/search';
const API_BASE = 'https://agent0-semantic-search.dawid-pisarczyk.workers.dev/api/v1';

const BASIC_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{"query": "AI agent for trading"}' | jq '.'`;

const COMPLEX_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "defi agent",
    "limit": 10,
    "filters": {
      "equals": {"chainId": 11155111},
      "in": {"capabilities": ["defi", "trading"]}
    },
    "minScore": 0.3
  }' | jq '.'`;

const PAGINATION_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "agent",
    "limit": 10,
    "offset": 10
  }' | jq '.'`;

const CURSOR_PAGINATION_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "agent",
    "limit": 10,
    "cursor": "eyJvZmZzZXQiOjEwfQ"
  }' | jq '.'`;

const NAME_SEARCH_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "trading agent",
    "name": "DeFi",
    "limit": 10
  }' | jq '.'`;

const MULTI_CHAIN_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "agent",
    "chains": [11155111, 84532],
    "limit": 10
  }' | jq '.'`;

const SORTING_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "agent",
    "sort": ["updatedAt:desc", "name:asc"],
    "limit": 10
  }' | jq '.'`;

const NEW_FILTERS_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "agent",
    "filters": {
      "equals": {
        "mcp": true,
        "a2a": false,
        "active": true
      },
      "in": {
        "operators": ["0x123...", "0x456..."]
      }
    },
    "limit": 10
  }' | jq '.'`;

function CodeBlock({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre className="bg-slate-900/60 border border-slate-800/50 rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-slate-100">{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen relative flex flex-col">
      <LiquidEtherBackground />
      <Header />

      <div className="container mx-auto px-4 py-8 relative z-10 max-w-4xl flex-1">
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold mb-4">Search API Documentation</h1>
            <p className="text-lg text-muted-foreground mb-4">
              Use our semantic search API to find ERC-8004 agents by description, capabilities, or natural language queries.
            </p>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
              <p className="text-sm">
                <strong>API Standard:</strong> This API implements the{' '}
                <a
                  href="https://www.notion.so/AG0-Semantic-Search-Standard-2bc47a22ae4680789ce4fc4a306bc9c8?source=copy_link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Universal Agent Semantic Search API Standard v1.0
                </a>
                {' '}for full specification details.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Endpoint</CardTitle>
              <CardDescription>The base URL for all search requests</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="text-sm bg-slate-900/60 px-3 py-2 rounded border border-slate-800/50">
                {API_ENDPOINT}
              </code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request Format</CardTitle>
              <CardDescription>All requests use POST with JSON body</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Request Parameters</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">query</Badge>
                    <span className="text-muted-foreground">(required) - Natural language search query</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">limit</Badge>
                    <span className="text-muted-foreground">(optional) - Maximum number of results per page (default: 10, max: 10)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">offset</Badge>
                    <span className="text-muted-foreground">(optional) - Number of results to skip (for offset-based pagination)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">cursor</Badge>
                    <span className="text-muted-foreground">(optional) - Pagination cursor from previous response (takes precedence over offset)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">filters</Badge>
                    <span className="text-muted-foreground">(optional) - Filter object using standard operators (see below)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">minScore</Badge>
                    <span className="text-muted-foreground">(optional) - Minimum similarity score (0.0 - 1.0)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">includeMetadata</Badge>
                    <span className="text-muted-foreground">(optional) - Include full metadata in results (default: true)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">name</Badge>
                    <span className="text-muted-foreground">(optional) - Substring search for agent name (post-filtered after semantic search)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">chains</Badge>
                    <span className="text-muted-foreground">(optional) - Multi-chain search: array of chain IDs (e.g., [11155111, 84532]) or &quot;all&quot; for all configured chains</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">sort</Badge>
                    <span className="text-muted-foreground">(optional) - Sort results by fields: array of strings in format [&quot;field:direction&quot;] (e.g., [&quot;updatedAt:desc&quot;, &quot;name:asc&quot;])</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Filter Operators</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Filters use standard operators for flexible querying:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">equals</Badge>
                    <span className="text-muted-foreground">- Exact match for field values (e.g., {`{"equals": {"chainId": 11155111}}`})</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">in</Badge>
                    <span className="text-muted-foreground">- Field value must be in array (e.g., {`{"in": {"capabilities": ["defi", "nft"]}}`})</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">notIn</Badge>
                    <span className="text-muted-foreground">- Field value must not be in array</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">exists</Badge>
                    <span className="text-muted-foreground">- Field must exist (array of field names)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">notExists</Badge>
                    <span className="text-muted-foreground">- Field must not exist (array of field names)</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Supported Filter Fields</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">chainId</Badge>
                    <span className="text-muted-foreground">- Blockchain network ID (use equals for single, in for multiple)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">capabilities</Badge>
                    <span className="text-muted-foreground">- Array of capability strings (use in operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">tags</Badge>
                    <span className="text-muted-foreground">- Array of trust model tags (use in operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">defaultInputMode</Badge>
                    <span className="text-muted-foreground">- Input mode (use equals operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">defaultOutputMode</Badge>
                    <span className="text-muted-foreground">- Output mode (use equals operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">owner</Badge>
                    <span className="text-muted-foreground">- Agent owner address (use equals operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">operators</Badge>
                    <span className="text-muted-foreground">- Array of operator addresses (use in operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">mcp</Badge>
                    <span className="text-muted-foreground">- Boolean: agent has MCP endpoint (use equals operator, derived from mcpEndpoint existence)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">a2a</Badge>
                    <span className="text-muted-foreground">- Boolean: agent has A2A endpoint (use equals operator, derived from a2aEndpoint existence)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">active</Badge>
                    <span className="text-muted-foreground">- Boolean: agent is active (use equals operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">x402support</Badge>
                    <span className="text-muted-foreground">- Boolean: agent supports x402 (use equals operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">mcpTools, mcpPrompts, mcpResources, a2aSkills</Badge>
                    <span className="text-muted-foreground">- Arrays of capability strings (use in operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">supportedTrusts</Badge>
                    <span className="text-muted-foreground">- Array of trust model strings (use in operator)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">createdAt, updatedAt</Badge>
                    <span className="text-muted-foreground">- Timestamps (use equals operator for exact match, or sort by these fields)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Format</CardTitle>
              <CardDescription>The API returns a JSON object with search results and pagination metadata</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900/60 border border-slate-800/50 rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-slate-100">{`{
  "query": "string",
  "results": [
    {
      "rank": 1,
      "vectorId": "string",
      "agentId": "string",
      "chainId": 11155111,
      "name": "string",
      "description": "string",
      "score": 0.95,
      "metadata": {
        "capabilities": ["defi", "trading"],
        "tags": ["reputation"],
        "image": "string",
        "mcp": true,
        "a2a": false
      }
    }
  ],
  "total": 50,
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJvZmZzZXQiOjEwfQ",
    "limit": 10,
    "offset": 0
  },
  "requestId": "uuid",
  "timestamp": "2024-01-01T00:00:00Z",
  "provider": {
    "name": "agent0-semantic-search",
    "version": "1.0.0"
  }
}`}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>Additional capabilities and features supported by the API</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="font-mono">nameSubstringSearch</Badge>
                  <span className="text-muted-foreground">- Post-filtered substring search for agent names. Use the <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">name</code> parameter to filter results by agent name after semantic search.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="font-mono">multiChainSearch</Badge>
                  <span className="text-muted-foreground">- Search across multiple blockchain networks using the <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">chains</code> parameter. Supports array of chain IDs or &quot;all&quot; for all configured chains.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="font-mono">sorting</Badge>
                  <span className="text-muted-foreground">- Sort search results by metadata fields using the <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">sort</code> parameter. Format: [&quot;field:direction&quot;] where field can be score, updatedAt, createdAt, name, etc.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="font-mono">nativeArrayFiltering</Badge>
                  <span className="text-muted-foreground">- Native Pinecone array filtering using the <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">in</code> operator for array fields like capabilities, tags, mcpTools, etc.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="font-mono">cursorPagination</Badge>
                  <span className="text-muted-foreground">- Efficient cursor-based pagination for large result sets. Use the <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">cursor</code> parameter from previous responses.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="font-mono">metadataFiltering</Badge>
                  <span className="text-muted-foreground">- Comprehensive metadata filtering using standard operators (equals, in, notIn, exists, notExists) on all indexed fields.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Examples</CardTitle>
              <CardDescription>Copy and run these examples to get started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Basic Search</h3>
                <CodeBlock code={BASIC_EXAMPLE} title="Basic search example" />
                <p className="text-sm text-muted-foreground mt-2">
                  This example performs a simple semantic search for agents related to &quot;AI agent for trading&quot;.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Complex Search with Filters</h3>
                <CodeBlock code={COMPLEX_EXAMPLE} title="Complex search with filter operators" />
                <p className="text-sm text-muted-foreground mt-2">
                  This example shows how to use standard filter operators (equals, in) to search for DeFi agents on Ethereum Sepolia with a minimum score threshold.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Offset-Based Pagination</h3>
                <CodeBlock code={PAGINATION_EXAMPLE} title="Pagination using offset" />
                <p className="text-sm text-muted-foreground mt-2">
                  Use the offset parameter to skip results and paginate through large result sets.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Cursor-Based Pagination</h3>
                <CodeBlock code={CURSOR_PAGINATION_EXAMPLE} title="Pagination using cursor" />
                <p className="text-sm text-muted-foreground mt-2">
                  Use the cursor from the previous response&apos;s pagination.nextCursor field for efficient pagination. Cursor takes precedence over offset when both are provided.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Name Substring Search</h3>
                <CodeBlock code={NAME_SEARCH_EXAMPLE} title="Name substring search" />
                <p className="text-sm text-muted-foreground mt-2">
                  Filter results by agent name using substring matching. This is applied as a post-filter after the semantic search.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Multi-Chain Search</h3>
                <CodeBlock code={MULTI_CHAIN_EXAMPLE} title="Multi-chain search" />
                <p className="text-sm text-muted-foreground mt-2">
                  Search across multiple blockchain networks using the chains parameter. Use an array of chain IDs or &quot;all&quot; to search all configured chains.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Sorting Results</h3>
                <CodeBlock code={SORTING_EXAMPLE} title="Sorting search results" />
                <p className="text-sm text-muted-foreground mt-2">
                  Sort results by one or more fields. Format: [&quot;field:direction&quot;] where direction is &quot;asc&quot; or &quot;desc&quot;. Supported fields: score, updatedAt, createdAt, name.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">New Filter Fields (MCP, A2A, Owner, Operators)</h3>
                <CodeBlock code={NEW_FILTERS_EXAMPLE} title="Using new filter fields" />
                <p className="text-sm text-muted-foreground mt-2">
                  Filter by MCP/A2A endpoint support (boolean fields), owner address, or operator addresses using standard filter operators.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supported Chain IDs</CardTitle>
              <CardDescription>Currently supported blockchain networks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">11155111</Badge>
                  <span className="text-sm">Ethereum Sepolia</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">84532</Badge>
                  <span className="text-sm">Base Sepolia</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">80002</Badge>
                  <span className="text-sm">Polygon Amoy</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Endpoints</CardTitle>
              <CardDescription>Other available API endpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <code className="text-sm bg-slate-900/60 px-3 py-2 rounded border border-slate-800/50">
                  GET {API_BASE}/capabilities
                </code>
                <p className="text-sm text-muted-foreground mt-1">
                  Get provider capabilities, limits, and supported features.
                </p>
              </div>
              <div>
                <code className="text-sm bg-slate-900/60 px-3 py-2 rounded border border-slate-800/50">
                  GET {API_BASE}/health
                </code>
                <p className="text-sm text-muted-foreground mt-1">
                  Health check endpoint with service status information.
                </p>
              </div>
              <div>
                <code className="text-sm bg-slate-900/60 px-3 py-2 rounded border border-slate-800/50">
                  GET {API_BASE}/schemas/{'{endpoint}'}
                </code>
                <p className="text-sm text-muted-foreground mt-1">
                  Get JSON schemas for API validation (optional endpoint).
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>API usage guidelines</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The API is currently available for public use. Please be respectful with request frequency.
                If you need higher rate limits for production use, please contact us.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Rate limit information is provided in response headers: <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">X-RateLimit-Limit</code>, <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">X-RateLimit-Remaining</code>, and <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">X-RateLimit-Reset</code>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}

