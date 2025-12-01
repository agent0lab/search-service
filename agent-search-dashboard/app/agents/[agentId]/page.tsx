'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, User, CheckCircle, Code, Users, Copy, Network, Shield, Info, Settings, BookOpen, Zap, Tag, FileText, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AgentCardSkill {
  id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
  security?: string[];
}

interface AgentCardExtension {
  uri?: string;
  description?: string;
  required?: boolean;
  params?: Record<string, unknown>;
}

interface AgentCardData {
  protocolVersion?: string;
  version?: string;
  url?: string;
  preferredTransport?: string;
  provider?: {
    organization?: string;
    url?: string;
  };
  iconUrl?: string;
  documentationUrl?: string;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
    extensions?: AgentCardExtension[];
  };
  supportsAuthenticatedExtendedCard?: boolean;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  skills?: AgentCardSkill[];
  securitySchemes?: Record<string, unknown>;
  security?: Array<Record<string, string[]>>;
  additionalInterfaces?: unknown[];
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
  mcpEndpoint?: string;
  mcpVersion?: string;
  a2aEndpoint?: string;
  a2aVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  agentURI?: string;
  agentCard?: AgentCardData;
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = decodeURIComponent(params.agentId as string);
  
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

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
        console.log('Agent data received:', {
          hasAgentCard: !!agentData.agentCard,
          agentCardKeys: agentData.agentCard ? Object.keys(agentData.agentCard) : [],
          skills: agentData.agentCard?.skills?.length || 0,
          extensions: agentData.agentCard?.capabilities?.extensions?.length || 0,
        });
        setAgent(agentData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent');
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [agentId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const getChainExplorerUrl = (chainId: number, address: string) => {
    const explorers: Record<number, string> = {
      11155111: `https://sepolia.etherscan.io/address/${address}`,
      84532: `https://sepolia.basescan.org/address/${address}`,
      80002: `https://amoy.polygonscan.com/address/${address}`,
    };
    return explorers[chainId] || `https://etherscan.io/address/${address}`;
  };

  const getTrustModelColor = (trust: string) => {
    const colors: Record<string, string> = {
      'reputation': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'crypto-economic': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'tee-attestation': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    };
    return colors[trust.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
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

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Hero Header */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-start gap-6">
              {agent.image ? (
                <div className="flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={agent.image}
                    alt={agent.name || 'Agent'}
                    className="w-24 h-24 rounded-lg object-cover border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-muted border flex items-center justify-center">
                  <span className="text-3xl font-bold text-muted-foreground">
                    {(agent.name || 'A')[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold mb-2">{agent.name || `Agent ${agentId}`}</h1>
                {agent.description && (
                  <p className="text-sm text-muted-foreground mb-4 break-words leading-relaxed">
                    {agent.description}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge variant={agent.active ? 'default' : 'secondary'} className="text-xs">
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
                  {agent.mcp && (
                    <Badge variant="secondary" className="text-xs">
                      <Code className="h-3 w-3 mr-1" />
                      MCP Enabled
                    </Badge>
                  )}
                  {agent.a2a && (
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      A2A Enabled
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <Network className="h-3 w-3 mr-1" />
                    Chain {agent.chainId}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Agent ID:</span>
                  <span className="font-mono font-medium">{agentId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(agentId, 'agentId')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {copied === 'agentId' && (
                    <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Overview */}
          {((agent.mcpTools && agent.mcpTools.length > 0) || (agent.a2aSkills && agent.a2aSkills.length > 0) || (agent.supportedTrusts && agent.supportedTrusts.length > 0) || (agent.owners && agent.owners.length > 0)) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Statistics Overview
                </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {agent.mcpTools && agent.mcpTools.length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-md">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Code className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="text-xs font-medium text-muted-foreground">MCP Tools</div>
                    </div>
                    <div className="text-xl font-bold">{agent.mcpTools.length}</div>
                  </div>
                )}
                {agent.a2aSkills && agent.a2aSkills.length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-md">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="text-xs font-medium text-muted-foreground">A2A Skills</div>
                    </div>
                    <div className="text-xl font-bold">{agent.a2aSkills.length}</div>
                  </div>
                )}
                {agent.supportedTrusts && agent.supportedTrusts.length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-md">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="text-xs font-medium text-muted-foreground">Trust Models</div>
                    </div>
                    <div className="text-xl font-bold">{agent.supportedTrusts.length}</div>
                  </div>
                )}
          {agent.owners && agent.owners.length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-md">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="text-xs font-medium text-muted-foreground">Owners</div>
                    </div>
                    <div className="text-xl font-bold">{agent.owners.length}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Tabs for organized content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {agent.agentCard?.skills && agent.agentCard.skills.length > 0 && (
                <TabsTrigger value="skills">Skills</TabsTrigger>
              )}
              {agent.agentCard && (
                <TabsTrigger value="protocol">Protocol</TabsTrigger>
              )}
              {agent.extras && Object.keys(agent.extras).length > 0 && (
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              )}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Information */}
                <Card className="h-fit">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-xs font-medium mb-1 text-muted-foreground">Chain ID</div>
                      <div className="text-sm font-mono font-semibold">{agent.chainId}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1 text-muted-foreground">x402 Support</div>
                      <div>
                        {agent.x402support ? (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </div>
                    {agent.agentURI && (
                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">Agent URI</div>
                        <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded-md">
                          <div className="text-xs font-mono flex-1 break-all">{agent.agentURI}</div>
                          <a
                            href={agent.agentURI}
                      target="_blank"
                      rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 flex-shrink-0"
                            onClick={() => copyToClipboard(agent.agentURI!, 'agentURI')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                  </div>
                        {copied === 'agentURI' && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Copied!</p>
                        )}
                    </div>
                    )}
                    {agent.createdAt && agent.createdAt !== '0' && parseInt(agent.createdAt, 10) > 0 && (
                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">Created At</div>
                        <div className="text-xs">
                          {new Date(parseInt(agent.createdAt, 10) * 1000).toLocaleString()}
                  </div>
                </div>
                    )}
                    {agent.updatedAt && agent.updatedAt !== '0' && parseInt(agent.updatedAt, 10) > 0 && (
                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">Last Updated</div>
                        <div className="text-xs">
                          {new Date(parseInt(agent.updatedAt, 10) * 1000).toLocaleString()}
                        </div>
                      </div>
                    )}
                    {agent.ens && (
                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">ENS</div>
                        <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded-md">
                          <div className="text-xs font-mono flex-1 break-all">{agent.ens}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 flex-shrink-0"
                            onClick={() => copyToClipboard(agent.ens!, 'ens')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {copied === 'ens' && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Copied!</p>
                        )}
                      </div>
                    )}
                    {agent.did && (
                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">DID</div>
                        <div className="flex items-center gap-1.5 p-2 bg-muted/30 rounded-md">
                          <div className="text-xs font-mono flex-1 break-all">{agent.did}</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 flex-shrink-0"
                            onClick={() => copyToClipboard(agent.did!, 'did')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {copied === 'did' && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Copied!</p>
                        )}
                      </div>
                    )}
                    {agent.walletAddress && (
                      <div>
                        <div className="text-xs font-medium mb-1 text-muted-foreground">Agent Wallet</div>
                        <div className="p-2 bg-muted/30 rounded-md">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="text-xs font-mono flex-1 break-all">{agent.walletAddress}</div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 flex-shrink-0"
                              onClick={() => copyToClipboard(agent.walletAddress!, 'wallet')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <a
                            href={getChainExplorerUrl(agent.chainId, agent.walletAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            View on explorer
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {copied === 'wallet' && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Copied!</p>
                        )}
                      </div>
                    )}
              </CardContent>
            </Card>

                {/* Right Column: Trust Models and Ownership */}
                <div className="space-y-6">
                  {/* Trust Models */}
                  {agent.supportedTrusts && agent.supportedTrusts.length > 0 && (
                    <Card className="h-fit">
                      <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <CardTitle className="text-lg">Trust Models</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
                        <div className="space-y-2">
                          {agent.supportedTrusts.map((trust, idx) => {
                            const descriptions: Record<string, string> = {
                              'reputation': 'Reputation-based trust system where agents build trust through verified interactions and feedback.',
                              'crypto-economic': 'Crypto-economic incentives ensure agents act honestly through staking and slashing mechanisms.',
                              'tee-attestation': 'Trusted Execution Environment (TEE) attestation provides hardware-backed security guarantees.',
                            };
                            return (
                              <div key={idx} className="p-2.5 border rounded-md bg-muted/30">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Badge variant="outline" className={`text-xs ${getTrustModelColor(trust)}`}>
                                    {trust.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')}
                                  </Badge>
                                </div>
                                {descriptions[trust.toLowerCase()] && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {descriptions[trust.toLowerCase()]}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
            </CardContent>
          </Card>
                  )}

                  {/* Owners */}
                  {agent.owners && agent.owners.length > 0 && (
            <Card>
                      <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <CardTitle className="text-lg">Owners ({agent.owners.length})</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {agent.owners.map((owner, idx) => (
                          <div key={idx} className="p-2.5 bg-muted/30 rounded-md border">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-muted-foreground mb-1">Owner {idx + 1}</div>
                                <div className="font-mono text-xs break-all">{owner}</div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <a
                                  href={getChainExplorerUrl(agent.chainId, owner)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                  title="View on explorer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => copyToClipboard(owner, `owner-${idx}`)}
                                  title="Copy address"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            {copied === `owner-${idx}` && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">Copied!</p>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Operators */}
              {agent.operators && agent.operators.length > 0 && (
                <Card className="mt-6">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <CardTitle className="text-lg">Operators ({agent.operators.length})</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {agent.operators.map((operator, idx) => (
                      <div key={idx} className="p-2.5 bg-muted/30 rounded-md border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground mb-1">Operator {idx + 1}</div>
                            <div className="font-mono text-xs break-all">{operator}</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <a
                              href={getChainExplorerUrl(agent.chainId, operator)}
                        target="_blank"
                        rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              title="View on explorer"
                      >
                              <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(operator, `operator-${idx}`)}
                              title="Copy address"
                      >
                              <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                        {copied === `operator-${idx}` && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">Copied!</p>
                )}
                  </div>
                    ))}
              </CardContent>
            </Card>
          )}

              {/* Endpoints */}
              {((agent.mcp && agent.mcpEndpoint) || (agent.a2a && agent.a2aEndpoint)) && (
            <Card>
                  <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <CardTitle className="text-lg">Endpoints</CardTitle>
                </div>
                    <p className="text-xs text-muted-foreground mt-1">Agent service endpoints</p>
              </CardHeader>
              <CardContent className="space-y-3">
                    {agent.mcp && agent.mcpEndpoint && (
                      <div className="p-3 bg-muted/30 rounded-md border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Code className="h-3.5 w-3.5" />
                            <div className="text-sm font-medium">MCP</div>
                          </div>
                          {agent.mcpVersion && agent.mcpVersion !== '0' && String(agent.mcpVersion).trim() !== '' && (
                            <Badge variant="secondary" className="text-xs font-normal">{agent.mcpVersion}</Badge>
                          )}
                        </div>
                    <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs break-all">{agent.mcpEndpoint}</div>
                          </div>
                      <a
                            href={agent.mcpEndpoint}
                        target="_blank"
                        rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                            <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                            className="h-7 w-7 p-0 flex-shrink-0"
                            onClick={() => copyToClipboard(agent.mcpEndpoint!, 'mcp-endpoint')}
                      >
                            <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                        {copied === 'mcp-endpoint' && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">Copied!</p>
                        )}
                  </div>
                )}
                    {agent.a2a && agent.a2aEndpoint && (
                      <div className="p-3 bg-muted/30 rounded-md border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            <div className="text-sm font-medium">A2A</div>
                  </div>
                          {agent.a2aVersion && agent.a2aVersion !== '0' && String(agent.a2aVersion).trim() !== '' && (
                            <Badge variant="secondary" className="text-xs font-normal">{agent.a2aVersion}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-xs break-all">{agent.a2aEndpoint}</div>
                          </div>
                          <a
                            href={agent.a2aEndpoint}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 flex-shrink-0"
                            onClick={() => copyToClipboard(agent.a2aEndpoint!, 'a2a-endpoint')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {copied === 'a2a-endpoint' && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1.5">Copied!</p>
                        )}
                      </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Capabilities */}
              {((agent.mcpTools && agent.mcpTools.length > 0) || 
                (agent.mcpPrompts && agent.mcpPrompts.length > 0) || 
                (agent.mcpResources && agent.mcpResources.length > 0) ||
                (agent.agentCard?.capabilities)) && (
                <div className="space-y-6">
                  {/* Agent Capabilities */}
                  {agent.agentCard?.capabilities && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          <CardTitle className="text-lg">Agent Capabilities</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {agent.agentCard.capabilities.streaming && (
                            <Badge variant="secondary" className="text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              Streaming
                            </Badge>
                          )}
                          {agent.agentCard.capabilities.pushNotifications && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Push Notifications
                            </Badge>
                          )}
                          {agent.agentCard.capabilities.stateTransitionHistory && (
                            <Badge variant="secondary" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              State Transition History
                            </Badge>
                          )}
                          {(!agent.agentCard.capabilities.streaming && 
                            !agent.agentCard.capabilities.pushNotifications && 
                            !agent.agentCard.capabilities.stateTransitionHistory) && (
                            <span className="text-sm text-muted-foreground">No capabilities enabled</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* MCP Tools */}
                  {agent.mcpTools && agent.mcpTools.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          <CardTitle className="text-lg">MCP Tools ({agent.mcpTools.length})</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1.5">
                          {agent.mcpTools.map((tool, idx) => (
                            <div key={idx} className="p-2 bg-muted/30 rounded-md border">
                              <div className="font-mono text-xs break-all">{tool}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* MCP Prompts */}
                  {agent.mcpPrompts && agent.mcpPrompts.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          <CardTitle className="text-lg">MCP Prompts ({agent.mcpPrompts.length})</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1.5">
                          {agent.mcpPrompts.map((prompt, idx) => (
                            <div key={idx} className="p-2 bg-muted/30 rounded-md border">
                              <div className="font-mono text-xs break-all">{prompt}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* MCP Resources */}
                  {agent.mcpResources && agent.mcpResources.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          <CardTitle className="text-lg">MCP Resources ({agent.mcpResources.length})</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1.5">
                          {agent.mcpResources.map((resource, idx) => (
                            <div key={idx} className="p-2 bg-muted/30 rounded-md border">
                              <div className="font-mono text-xs break-all">{resource}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Skills Tab */}
            {agent.agentCard?.skills && agent.agentCard.skills.length > 0 && (
              <TabsContent value="skills" className="space-y-6">
            <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <CardTitle className="text-lg">Skills</CardTitle>
                    </div>
                <p className="text-xs text-muted-foreground mt-1">Agent capabilities and use cases</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {agent.agentCard.skills.map((skill, idx) => (
                  <div key={skill.id || idx} className="p-4 bg-muted/30 rounded-md border space-y-3">
                  <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-sm font-semibold">{skill.name || `Skill ${idx + 1}`}</h4>
                        {skill.id && (
                          <Badge variant="outline" className="text-xs font-mono">{skill.id}</Badge>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{skill.description}</p>
                      )}
                    </div>
                    
                    {skill.tags && skill.tags.length > 0 && (
                      <div>
                        <div className="text-xs font-medium mb-1.5 text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {skill.tags.map((tag, tagIdx) => (
                            <Badge key={tagIdx} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                    
                    {skill.examples && skill.examples.length > 0 && (
                  <div>
                        <div className="text-xs font-medium mb-1.5 text-muted-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Examples
                        </div>
                        <div className="space-y-1.5">
                          {skill.examples.map((example, exIdx) => (
                            <div key={exIdx} className="p-2 bg-background rounded border-l-2 border-primary/30 text-xs font-mono">
                              {example}
                            </div>
                      ))}
                    </div>
                  </div>
                )}
                    
                    {(skill.inputModes || skill.outputModes) && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        {skill.inputModes && skill.inputModes.length > 0 && (
                  <div>
                            <div className="text-xs font-medium mb-1 text-muted-foreground">Input Modes</div>
                            <div className="flex flex-wrap gap-1">
                              {skill.inputModes.map((mode, modeIdx) => (
                                <Badge key={modeIdx} variant="outline" className="text-xs">{mode}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                        {skill.outputModes && skill.outputModes.length > 0 && (
                  <div>
                            <div className="text-xs font-medium mb-1 text-muted-foreground">Output Modes</div>
                            <div className="flex flex-wrap gap-1">
                              {skill.outputModes.map((mode, modeIdx) => (
                                <Badge key={modeIdx} variant="outline" className="text-xs">{mode}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
              </TabsContent>
            )}

            {/* Protocol Tab */}
            {agent.agentCard && (
              <TabsContent value="protocol" className="space-y-6">
                {/* Extensions */}
          {agent.agentCard?.capabilities?.extensions && agent.agentCard.capabilities.extensions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <CardTitle className="text-lg">Extensions</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Protocol extensions and additional features</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.agentCard.capabilities.extensions.map((extension, idx) => (
                  <div key={idx} className="p-3 bg-muted/30 rounded-md border">
                    {extension.uri && (
                      <div className="flex items-center gap-2 mb-2">
                        <a
                          href={extension.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          <Globe className="h-3 w-3" />
                          Extension URI
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        {extension.required && (
                          <Badge variant="default" className="text-xs">Required</Badge>
                        )}
                      </div>
                    )}
                    {extension.description && (
                      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{extension.description}</p>
                    )}
                    {extension.params && Object.keys(extension.params).length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="text-xs font-medium mb-1.5 text-muted-foreground">Parameters</div>
                        <div className="space-y-1">
                          {Object.entries(extension.params).map(([key, value]) => (
                            <div key={key} className="flex items-start gap-2 text-xs">
                              <span className="font-mono font-medium min-w-[100px]">{key}:</span>
                              <span className="text-muted-foreground break-all">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

              {/* Security Schemes */}
              {agent.agentCard?.securitySchemes && Object.keys(agent.agentCard.securitySchemes).length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <CardTitle className="text-lg">Security Schemes</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(agent.agentCard.securitySchemes).map(([key, scheme]) => (
                        <div key={key} className="p-3 bg-muted/30 rounded-md border">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">{key}</Badge>
                          </div>
                          <pre className="text-xs font-mono overflow-auto">
                            {JSON.stringify(scheme, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Protocol Information */}
          <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <CardTitle className="text-lg">Protocol Information</CardTitle>
                  </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {agent.agentCard.protocolVersion && (
                <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Protocol Version</div>
                    <div className="text-sm font-mono">{agent.agentCard.protocolVersion}</div>
                </div>
                )}
                {agent.agentCard.version && (
                <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Agent Version</div>
                    <div className="text-sm font-mono">{agent.agentCard.version}</div>
                  </div>
                )}
                {agent.agentCard.preferredTransport && (
                  <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Preferred Transport</div>
                    <Badge variant="outline" className="text-xs">{agent.agentCard.preferredTransport}</Badge>
                  </div>
                )}
                {agent.agentCard.provider && (
                  <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Provider</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{agent.agentCard.provider.organization || 'Unknown'}</span>
                      {agent.agentCard.provider.url && (
                        <a
                          href={agent.agentCard.provider.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-xs"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                </div>
              </div>
                )}
                {agent.agentCard.documentationUrl && (
                <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Documentation</div>
                    <a
                      href={agent.agentCard.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      View Documentation
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
              )}
                {agent.agentCard.defaultInputModes && agent.agentCard.defaultInputModes.length > 0 && (
                <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Default Input Modes</div>
                    <div className="flex flex-wrap gap-1">
                      {agent.agentCard.defaultInputModes.map((mode, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{mode}</Badge>
                      ))}
                </div>
                </div>
              )}
                {agent.agentCard.defaultOutputModes && agent.agentCard.defaultOutputModes.length > 0 && (
                <div>
                    <div className="text-xs font-medium mb-1 text-muted-foreground">Default Output Modes</div>
                    <div className="flex flex-wrap gap-1">
                      {agent.agentCard.defaultOutputModes.map((mode, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{mode}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
            </TabsContent>
            )}

            {/* Metadata Tab */}
            {agent.extras && Object.keys(agent.extras).length > 0 && (
              <TabsContent value="metadata" className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Additional Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(agent.extras).map(([key, value]) => (
                        <div key={key} className="p-2.5 bg-muted/30 rounded-md border">
                          <div className="text-xs font-medium mb-1 text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div className="text-xs break-all font-mono">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
