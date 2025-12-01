'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, User, CheckCircle, Code, Users, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  mcpEndpoint?: string;
  mcpVersion?: string;
  a2aEndpoint?: string;
  a2aVersion?: string;
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = decodeURIComponent(params.agentId as string);
  
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;

    const loadAgent = async () => {
      setLoading(true);
      setError(null);

      try {
        const encodedAgentId = encodeURIComponent(agentId);
        const response = await fetch(`/api/agents/${encodedAgentId}`);
        
        if (!response.ok) {
          const errorData = await response.json() as { error: string };
          throw new Error(errorData.error || `Failed to load agent: ${response.statusText}`);
        }

        const agentData = await response.json() as AgentSummary;
        setAgent(agentData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent');
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [agentId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading agent details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-4 py-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
          </Link>
          <Card className="border-destructive">
            <CardContent className="p-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              {agent.image ? (
                <div className="flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={agent.image}
                    alt={agent.name || 'Agent'}
                    className="w-20 h-20 rounded-lg object-cover border"
                    onError={(e) => {
                      // Hide image if it fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center border">
                  <span className="text-2xl font-semibold text-slate-600 dark:text-slate-300">
                    {(agent.name || 'A')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold mb-2">{agent.name || `Agent ${agentId}`}</h1>
                <p className="text-muted-foreground break-words">{agent.description || 'No description available'}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="font-mono text-xs">
                    {agentId}
                  </Badge>
                  <Badge variant={agent.active ? 'default' : 'secondary'}>
                    {agent.active ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Owner Card */}
          {agent.owners && agent.owners.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span className="font-mono text-sm">{formatAddress(agent.owners[0])}</span>
                    <a
                      href={`https://etherscan.io/address/${agent.owners[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">100</span>
                    </div>
                    <span className="text-sm text-muted-foreground">-</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Validations - Placeholder for now */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <CardTitle>Recent Validations</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No validations available</p>
            </CardContent>
          </Card>

          {/* MCP Section */}
          {agent.mcp && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  <CardTitle>MCP (Model Context Protocol)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.mcpEndpoint && (
                  <div>
                    <div className="text-sm font-medium mb-1 text-muted-foreground">ENDPOINT</div>
                    <div className="flex items-center gap-2">
                      <a
                        href={agent.mcpEndpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {agent.mcpEndpoint}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(agent.mcpEndpoint!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {agent.mcpVersion && (
                  <div>
                    <div className="text-sm font-medium mb-1 text-muted-foreground">VERSION</div>
                    <div className="text-sm">{agent.mcpVersion}</div>
                  </div>
                )}
                {!agent.mcpEndpoint && (
                  <p className="text-sm text-muted-foreground">MCP enabled but endpoint not available</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* A2A Section */}
          {agent.a2a && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <CardTitle>A2A (Agent-to-Agent)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.a2aEndpoint && (
                  <div>
                    <div className="text-sm font-medium mb-1 text-muted-foreground">ENDPOINT</div>
                    <div className="flex items-center gap-2">
                      <a
                        href={agent.a2aEndpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                      >
                        {agent.a2aEndpoint}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => copyToClipboard(agent.a2aEndpoint!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {agent.a2aVersion && (
                  <div>
                    <div className="text-sm font-medium mb-1 text-muted-foreground">VERSION</div>
                    <div className="text-sm">{agent.a2aVersion}</div>
                  </div>
                )}
                {!agent.a2aEndpoint && (
                  <p className="text-sm text-muted-foreground">A2A enabled but endpoint not available</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Capabilities */}
          {(agent.mcpTools?.length || agent.mcpPrompts?.length || agent.mcpResources?.length || agent.a2aSkills?.length) && (
            <Card>
              <CardHeader>
                <CardTitle>Capabilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {agent.mcpTools && agent.mcpTools.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">MCP Tools ({agent.mcpTools.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {agent.mcpTools.map((tool, idx) => (
                        <Badge key={idx} variant="secondary">{tool}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {agent.mcpPrompts && agent.mcpPrompts.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">MCP Prompts ({agent.mcpPrompts.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {agent.mcpPrompts.map((prompt, idx) => (
                        <Badge key={idx} variant="secondary">{prompt}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {agent.mcpResources && agent.mcpResources.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">MCP Resources ({agent.mcpResources.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {agent.mcpResources.map((resource, idx) => (
                        <Badge key={idx} variant="secondary">{resource}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {agent.a2aSkills && agent.a2aSkills.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">A2A Skills ({agent.a2aSkills.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {agent.a2aSkills.map((skill, idx) => (
                        <Badge key={idx} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1 text-muted-foreground">Chain ID</div>
                  <div className="text-sm font-mono">{agent.chainId}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1 text-muted-foreground">x402 Support</div>
                  <div>
                    {agent.x402support ? (
                      <Badge variant="default">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {agent.ens && (
                <div>
                  <div className="text-sm font-medium mb-1 text-muted-foreground">ENS</div>
                  <div className="text-sm font-mono">{agent.ens}</div>
                </div>
              )}
              {agent.did && (
                <div>
                  <div className="text-sm font-medium mb-1 text-muted-foreground">DID</div>
                  <div className="text-sm font-mono break-all">{agent.did}</div>
                </div>
              )}
              {agent.walletAddress && (
                <div>
                  <div className="text-sm font-medium mb-1 text-muted-foreground">Agent Wallet</div>
                  <div className="text-sm font-mono">{agent.walletAddress}</div>
                </div>
              )}
              {agent.supportedTrusts && agent.supportedTrusts.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1 text-muted-foreground">Trust Models</div>
                  <div className="flex flex-wrap gap-2">
                    {agent.supportedTrusts.map((trust, idx) => (
                      <Badge key={idx} variant="outline">{trust}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
