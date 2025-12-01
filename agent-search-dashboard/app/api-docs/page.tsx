'use client';

import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { LiquidEtherBackground } from '@/components/LiquidEtherBackground';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState } from 'react';

const API_ENDPOINT = 'https://agent0-semantic-search.dawid-pisarczyk.workers.dev/api/search';

const BASIC_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{"query": "AI agent for trading"}' | jq '.'`;

const COMPLEX_EXAMPLE = `curl -s -X POST ${API_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{"query": "defi agent", "topK": 3, "filters": {"chainId": 11155111}, "minScore": 0.3}' | jq '.'`;

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
            <p className="text-lg text-muted-foreground">
              Use our semantic search API to find ERC-8004 agents by description, capabilities, or natural language queries.
            </p>
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
                    <Badge variant="outline" className="font-mono">topK</Badge>
                    <span className="text-muted-foreground">(optional) - Maximum number of results (default: 10, max: 10)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">filters</Badge>
                    <span className="text-muted-foreground">(optional) - Filter object (see below)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">minScore</Badge>
                    <span className="text-muted-foreground">(optional) - Minimum similarity score (0.0 - 1.0)</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Filter Object</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">chainId</Badge>
                    <span className="text-muted-foreground">- Filter by blockchain network ID (e.g., 11155111 for Ethereum Sepolia)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">capabilities</Badge>
                    <span className="text-muted-foreground">- Array of capability strings (e.g., ["defi", "nft"])</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">tags</Badge>
                    <span className="text-muted-foreground">- Array of trust model tags (e.g., ["reputation", "crypto-economic"])</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">defaultInputMode</Badge>
                    <span className="text-muted-foreground">- Filter by input mode (e.g., "text", "json", "image")</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="font-mono">defaultOutputMode</Badge>
                    <span className="text-muted-foreground">- Filter by output mode (e.g., "text", "json", "image")</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Format</CardTitle>
              <CardDescription>The API returns a JSON object with search results</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900/60 border border-slate-800/50 rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-slate-100">{`{
  "results": [
    {
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
  ]
}`}</code>
              </pre>
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
                  This example performs a simple semantic search for agents related to "AI agent for trading".
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Complex Search with Filters</h3>
                <CodeBlock code={COMPLEX_EXAMPLE} title="Complex search with all parameters" />
                <p className="text-sm text-muted-foreground mt-2">
                  This example shows how to use filters to search for DeFi agents on Ethereum Sepolia with a minimum score threshold.
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
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>API usage guidelines</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The API is currently available for public use. Please be respectful with request frequency.
                If you need higher rate limits for production use, please contact us.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}

