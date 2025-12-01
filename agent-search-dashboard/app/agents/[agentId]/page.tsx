'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, User, CheckCircle, Code, Users, Copy, Network, Shield, Info, Settings, BookOpen, Zap, Tag, FileText, Globe, Building2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Header } from '@/components/Header';

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
  const router = useRouter();
  const agentId = decodeURIComponent(params.agentId as string);
  
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [backUrl, setBackUrl] = useState('/');

  // Determine where to go back based on referrer or sessionStorage
  useEffect(() => {
    // Check if we have a stored search state (user came from search page)
    const storedState = sessionStorage.getItem('agent-search-state');
    if (storedState) {
      setBackUrl('/search');
    } else {
      // Check document referrer
      const referrer = document.referrer;
      if (referrer && (referrer.includes('/search') || referrer.includes('?q='))) {
        setBackUrl('/search');
      } else {
        setBackUrl('/');
      }
    }
  }, []);

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
          capabilities: !!agentData.agentCard?.capabilities,
          agentURI: agentData.agentURI,
          fullAgentCard: agentData.agentCard,
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading agent details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Link href={backUrl}>
            <Button variant="ghost" className="mb-4 gap-2 text-muted-foreground hover:text-foreground hover:bg-slate-800/50">
              <ArrowLeft className="h-4 w-4" />
              {backUrl === '/search' ? 'Back to Search' : 'Back to Home'}
            </Button>
          </Link>
          <Card className="border-destructive bg-slate-800/50">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <Link href={backUrl}>
          <Button variant="ghost" className="mb-6 gap-2 text-muted-foreground hover:text-foreground hover:bg-slate-800/50">
            <ArrowLeft className="h-4 w-4" />
            {backUrl === '/search' ? 'Back to Search' : 'Back to Home'}
          </Button>
        </Link>

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Hero Header */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
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
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">{agent.name || `Agent ${agentId}`}</h1>
                  {(() => {
                    const warnings: string[] = [];
                    const agentURI = agent.agentURI;
                    // Only warn if agentURI is missing, null, or empty string
                    if (!agentURI || (typeof agentURI === 'string' && agentURI.trim() === '')) {
                      warnings.push('Agent URI');
                    }
                    // Only warn if description is missing or empty
                    if (!agent.description || (typeof agent.description === 'string' && agent.description.trim() === '')) {
                      warnings.push('Description');
                    }
                    const hasMissingData = warnings.length > 0;
                    
                    return hasMissingData ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Missing: {warnings.join(', ')}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : null;
                  })()}
                </div>
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
                    {(() => {
                      const chainNames: Record<number, string> = {
                        11155111: 'Ethereum Sepolia',
                        84532: 'Base Sepolia',
                        80002: 'Polygon Amoy',
                      };
                      return chainNames[agent.chainId] || `Chain ${agent.chainId}`;
                    })()}
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

          {/* Tabs for organized content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="w-full mb-6">
              <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-slate-800/50 p-1 text-muted-foreground gap-1 border border-slate-700">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                {((agent.agentCard?.skills && agent.agentCard.skills.length > 0) || (agent.a2aSkills && agent.a2aSkills.length > 0) || (agent.mcpTools && agent.mcpTools.length > 0)) ? (
                  <TabsTrigger value="skills">Skills</TabsTrigger>
                ) : null}
                {agent.agentCard?.capabilities ? (
                  <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
                ) : null}
                {(agent.mcpEndpoint || agent.a2aEndpoint || agent.agentURI) ? (
                  <TabsTrigger value="protocol">Protocol</TabsTrigger>
                ) : null}
                {agent.extras && Object.keys(agent.extras).length > 0 ? (
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                ) : null}
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Information */}
                <Card className="h-fit bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-xs font-medium mb-1 text-muted-foreground">Chain</div>
                      <div className="text-sm font-semibold">
                        {(() => {
                          const chainNames: Record<number, string> = {
                            11155111: 'Ethereum Sepolia',
                            84532: 'Base Sepolia',
                            80002: 'Polygon Amoy',
                          };
                          const chainName = chainNames[agent.chainId];
                          return chainName ? (
                            <>
                              {chainName}
                              <span className="text-xs text-muted-foreground font-mono ml-2">({agent.chainId})</span>
                            </>
                          ) : (
                            `Chain ${agent.chainId}`
                          );
                        })()}
                      </div>
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
                  {/* Provider & Documentation - Combined */}
                  {(agent.agentCard?.provider || agent.agentCard?.documentationUrl) && (
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <CardTitle className="text-lg">Provider</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {agent.agentCard.provider?.organization && (
                          <div>
                            <div className="text-xs font-medium mb-1.5 text-muted-foreground">Organization</div>
                            <div className="text-sm font-semibold">{agent.agentCard.provider.organization}</div>
                          </div>
                        )}
                        {agent.agentCard.provider?.url && (
                          <div>
                            <div className="text-xs font-medium mb-1.5 text-muted-foreground">Provider URL</div>
                            <a
                              href={agent.agentCard.provider.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 group"
                            >
                              <span className="break-all">{agent.agentCard.provider.url}</span>
                              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                            </a>
                          </div>
                        )}
                        {agent.agentCard.documentationUrl && (
                          <div>
                            <div className="text-xs font-medium mb-1.5 text-muted-foreground">Documentation</div>
                            <a
                              href={agent.agentCard.documentationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 group"
                            >
                              <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>View Documentation</span>
                              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                            </a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Security Schemes Summary */}
                  {agent.agentCard?.securitySchemes && Object.keys(agent.agentCard.securitySchemes).length > 0 && (
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <CardTitle className="text-lg">Authentication</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(agent.agentCard.securitySchemes).map(([schemeName, scheme]) => {
                            const isRequired = agent.agentCard?.security?.some(sec => sec[schemeName]);
                            
                            return (
                              <Badge
                                key={schemeName}
                                variant={isRequired ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {schemeName}
                                {isRequired && ' • Required'}
                              </Badge>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {/* Trust Models */}
                  {agent.supportedTrusts && agent.supportedTrusts.length > 0 && (
                    <Card className="h-fit bg-slate-800/50 border-slate-700">
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
            <Card className="bg-slate-800/50 border-slate-700">
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
                <Card className="mt-6 bg-slate-800/50 border-slate-700">
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
            <Card className="bg-slate-800/50 border-slate-700">
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
            </TabsContent>

            {/* Skills Tab */}
            {((agent.agentCard?.skills && agent.agentCard.skills.length > 0) || (agent.a2aSkills && agent.a2aSkills.length > 0) || (agent.mcpTools && agent.mcpTools.length > 0)) && (
              <TabsContent value="skills" className="space-y-6">
                {/* All Skill Tags - Combined from all skills */}
                {agent.agentCard?.skills && agent.agentCard.skills.length > 0 && (() => {
                  const allTags = agent.agentCard.skills
                    .flatMap(skill => skill.tags || [])
                    .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
                  
                  return allTags.length > 0 ? (
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          <CardTitle className="text-lg">Skill Tags</CardTitle>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          All tags associated with this agent's skills.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {allTags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-sm px-3 py-1">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null;
                })()}

                {/* Agent Card Skills - Full Details */}
                {agent.agentCard?.skills && agent.agentCard.skills.length > 0 && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        <CardTitle className="text-lg">Skills ({agent.agentCard.skills.length})</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        Detailed capabilities and skills that this agent can perform.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {agent.agentCard.skills.map((skill, idx) => (
                        <div key={skill.id || idx} className="p-6 bg-slate-900/50 rounded-lg border border-slate-700 hover:bg-slate-900/70 transition-colors">
                          <div className="space-y-4">
                            {/* Skill Header */}
                            <div>
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1">
                                  <h3 className="text-xl font-semibold mb-1">{skill.name || `Skill ${idx + 1}`}</h3>
                                  {skill.id && (
                                    <div className="text-xs font-mono text-muted-foreground mb-2">{skill.id}</div>
                                  )}
                                </div>
                                {skill.id && (
                                  <Badge variant="outline" className="text-xs">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {skill.id}
                                  </Badge>
                                )}
                              </div>
                              {skill.description && (
                                <p className="text-sm text-muted-foreground leading-relaxed">{skill.description}</p>
                              )}
                            </div>

                            {/* Tags */}
                            {skill.tags && skill.tags.length > 0 && (
                              <div>
                                <div className="text-xs font-medium mb-2 text-muted-foreground flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  Tags
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {skill.tags.map((tag, tagIdx) => (
                                    <Badge key={tagIdx} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Examples */}
                            {skill.examples && skill.examples.length > 0 && (
                              <div>
                                <div className="text-xs font-medium mb-2 text-muted-foreground flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  Examples
                                </div>
                                <div className="space-y-2">
                                  {skill.examples.map((example, exIdx) => (
                                    <div key={exIdx} className="p-3 bg-slate-800/50 rounded border-l-2 border-primary/50 text-sm font-mono">
                                      {example}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Input/Output Modes */}
                            {(skill.inputModes || skill.outputModes) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-700">
                                {skill.inputModes && skill.inputModes.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium mb-2 text-muted-foreground">Input Modes</div>
                                    <div className="flex flex-wrap gap-2">
                                      {skill.inputModes.map((mode, modeIdx) => (
                                        <Badge key={modeIdx} variant="outline" className="text-xs">
                                          {mode}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {skill.outputModes && skill.outputModes.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium mb-2 text-muted-foreground">Output Modes</div>
                                    <div className="flex flex-wrap gap-2">
                                      {skill.outputModes.map((mode, modeIdx) => (
                                        <Badge key={modeIdx} variant="outline" className="text-xs">
                                          {mode}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* A2A Skills - Fallback */}
                {!agent.agentCard?.skills && agent.a2aSkills && agent.a2aSkills.length > 0 && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <CardTitle className="text-lg">A2A Skills ({agent.a2aSkills.length})</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        Agent-to-Agent (A2A) skills define the capabilities this agent can perform when communicating with other agents.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {agent.a2aSkills.map((skill, idx) => {
                        const formattedSkill = skill
                          .split(/[\/_\-]/)
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                        const isSkillId = skill.includes('/') || skill.includes('_') || skill.includes('-');
                        
                        return (
                          <div key={idx} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:bg-slate-900/70 transition-colors">
                            <div className="flex items-start gap-3">
                              <Badge variant="outline" className="text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                Skill
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <div className="text-base font-semibold mb-1">{isSkillId ? formattedSkill : skill}</div>
                                {isSkillId && (
                                  <div className="text-xs font-mono text-muted-foreground mb-2">{skill}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* MCP Tools - Fallback */}
                {agent.mcpTools && agent.mcpTools.length > 0 && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        <CardTitle className="text-lg">MCP Tools ({agent.mcpTools.length})</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        Model Context Protocol (MCP) tools are executable functions that this agent can invoke.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {agent.mcpTools.map((tool, idx) => (
                        <div key={idx} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:bg-slate-900/70 transition-colors">
                          <div className="flex items-start gap-3">
                            <Badge variant="outline" className="text-xs">
                              <Code className="h-3 w-3 mr-1" />
                              Tool
                            </Badge>
                            <div className="text-base font-semibold">{tool}</div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            {/* Capabilities Tab */}
            {agent.agentCard?.capabilities && (
              <TabsContent value="capabilities" className="space-y-6">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <CardTitle className="text-lg">Capabilities</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Protocol capabilities and features supported by this agent.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Basic Capabilities */}
                    <div>
                      <div className="text-sm font-medium mb-3">Protocol Features</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {agent.agentCard.capabilities.streaming && (
                          <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">Streaming</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Supports streaming responses</p>
                          </div>
                        )}
                        {agent.agentCard.capabilities.pushNotifications && (
                          <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">Push Notifications</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Can send push notifications</p>
                          </div>
                        )}
                        {agent.agentCard.capabilities.stateTransitionHistory && (
                          <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">State Transition History</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Tracks state transitions</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Extensions */}
                    {agent.agentCard.capabilities.extensions && agent.agentCard.capabilities.extensions.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-3">Extensions</div>
                        <div className="space-y-4">
                          {agent.agentCard.capabilities.extensions.map((extension, idx) => (
                            <div key={idx} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                              <div className="space-y-3">
                                {extension.uri && (
                                  <div className="flex items-start justify-between gap-3">
                                    <a
                                      href={extension.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1 flex-1"
                                    >
                                      <Globe className="h-3.5 w-3.5" />
                                      Extension URI
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                    {extension.required && (
                                      <Badge variant="default" className="text-xs">Required</Badge>
                                    )}
                                    {!extension.required && (
                                      <Badge variant="secondary" className="text-xs">Optional</Badge>
                                    )}
                                  </div>
                                )}
                                {extension.description && (
                                  <p className="text-sm text-muted-foreground leading-relaxed">{extension.description}</p>
                                )}
                                {extension.params && Object.keys(extension.params).length > 0 && (
                                  <div className="pt-3 border-t border-slate-700">
                                    <div className="text-xs font-medium mb-2 text-muted-foreground">Parameters</div>
                                    <div className="space-y-2">
                                      {Object.entries(extension.params).map(([key, value]) => (
                                        <div key={key} className="flex items-start gap-2 text-sm">
                                          <span className="font-mono font-medium min-w-[120px] text-muted-foreground">{key}:</span>
                                          <span className="text-foreground break-all">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Default Input/Output Modes */}
                    {(agent.agentCard.defaultInputModes || agent.agentCard.defaultOutputModes) && (
                      <div>
                        <div className="text-sm font-medium mb-3">Default Modes</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {agent.agentCard.defaultInputModes && agent.agentCard.defaultInputModes.length > 0 && (
                            <div>
                              <div className="text-xs font-medium mb-2 text-muted-foreground">Default Input Modes</div>
                              <div className="flex flex-wrap gap-2">
                                {agent.agentCard.defaultInputModes.map((mode, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {mode}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {agent.agentCard.defaultOutputModes && agent.agentCard.defaultOutputModes.length > 0 && (
                            <div>
                              <div className="text-xs font-medium mb-2 text-muted-foreground">Default Output Modes</div>
                              <div className="flex flex-wrap gap-2">
                                {agent.agentCard.defaultOutputModes.map((mode, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {mode}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Protocol Tab */}
            {(agent.mcpEndpoint || agent.a2aEndpoint || agent.agentURI || agent.agentCard?.protocolVersion || agent.agentCard?.securitySchemes || agent.agentCard?.provider || agent.agentCard?.documentationUrl) && (
              <TabsContent value="protocol" className="space-y-6">
                {/* Endpoints - already shown in Overview, but show here too for completeness */}
                {((agent.mcp && agent.mcpEndpoint) || (agent.a2a && agent.a2aEndpoint)) && (
                  <Card className="bg-slate-800/50 border-slate-700">
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

                {/* Agent URI */}
                {agent.agentURI && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <CardTitle className="text-lg">Agent URI</CardTitle>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Agent card URI</p>
                    </CardHeader>
                    <CardContent>
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
                          onClick={() => copyToClipboard(agent.agentURI!, 'agentURI-protocol')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {copied === 'agentURI-protocol' && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">Copied!</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Protocol Information */}
                {(agent.agentCard?.protocolVersion || agent.agentCard?.preferredTransport || agent.agentCard?.version || agent.agentCard?.url) && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        <CardTitle className="text-lg">Protocol Information</CardTitle>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Protocol version and transport details</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {agent.agentCard.protocolVersion && (
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                          <span className="text-sm font-medium">Protocol Version</span>
                          <Badge variant="secondary" className="text-xs">{agent.agentCard.protocolVersion}</Badge>
                        </div>
                      )}
                      {agent.agentCard.version && (
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                          <span className="text-sm font-medium">Agent Version</span>
                          <Badge variant="outline" className="text-xs">{agent.agentCard.version}</Badge>
                        </div>
                      )}
                      {agent.agentCard.preferredTransport && (
                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                          <span className="text-sm font-medium">Preferred Transport</span>
                          <Badge variant="outline" className="text-xs">{agent.agentCard.preferredTransport}</Badge>
                        </div>
                      )}
                      {agent.agentCard.url && (
                        <div className="p-2 bg-muted/30 rounded-md">
                          <div className="text-xs font-medium mb-1 text-muted-foreground">Agent URL</div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-mono flex-1 break-all">{agent.agentCard.url}</div>
                            <a
                              href={agent.agentCard.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground flex-shrink-0"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      )}
                      {agent.agentCard.supportsAuthenticatedExtendedCard && (
                        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Supports Authenticated Extended Card</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}


                {/* Security Schemes */}
                {agent.agentCard?.securitySchemes && Object.keys(agent.agentCard.securitySchemes).length > 0 && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <CardTitle className="text-lg">Security Schemes</CardTitle>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Authentication and security methods</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(agent.agentCard.securitySchemes).map(([schemeName, scheme]) => {
                        const schemeData = scheme as any;
                        const isRequired = agent.agentCard?.security?.some(sec => sec[schemeName]);
                        
                        return (
                          <div key={schemeName} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold capitalize">{schemeName}</span>
                              </div>
                              {isRequired && (
                                <Badge variant="default" className="text-xs">Required</Badge>
                              )}
                              {!isRequired && (
                                <Badge variant="secondary" className="text-xs">Optional</Badge>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              {schemeData.type && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-medium text-muted-foreground min-w-[80px]">Type:</span>
                                  <Badge variant="outline" className="text-xs">{schemeData.type}</Badge>
                                </div>
                              )}
                              {schemeData.scheme && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-medium text-muted-foreground min-w-[80px]">Scheme:</span>
                                  <Badge variant="outline" className="text-xs">{schemeData.scheme}</Badge>
                                </div>
                              )}
                              {schemeData.in && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-medium text-muted-foreground min-w-[80px]">Location:</span>
                                  <Badge variant="outline" className="text-xs">{schemeData.in}</Badge>
                                </div>
                              )}
                              {schemeData.name && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-medium text-muted-foreground min-w-[80px]">Name:</span>
                                  <span className="font-mono text-xs">{schemeData.name}</span>
                                </div>
                              )}
                              {schemeData.description && (
                                <div className="pt-2 border-t border-slate-700">
                                  <p className="text-xs text-muted-foreground leading-relaxed">{schemeData.description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}

            {/* Metadata Tab */}
            {agent.extras && Object.keys(agent.extras).length > 0 && (
              <TabsContent value="metadata" className="space-y-6">
                <Card className="bg-slate-800/50 border-slate-700">
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
