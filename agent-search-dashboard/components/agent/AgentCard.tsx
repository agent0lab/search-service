'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, XCircle, Code, Users, Copy, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SemanticSearchResult } from '@/lib/types';
import { useState } from 'react';

interface AgentCardProps {
  result: SemanticSearchResult;
  agentImage?: string;
  onImageError?: () => void;
  getChainName: (chainId: number) => string;
  formatAgentId: (agentId: string) => string;
  agentURIsLoaded?: boolean; // Only show warnings after URIs are loaded
}

export function AgentCard({ result, agentImage, getChainName, formatAgentId, agentURIsLoaded = false }: AgentCardProps) {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const capabilities = result.metadata?.capabilities;
  const capabilitiesArray = Array.isArray(capabilities) ? (capabilities as string[]) : [];
  const trustModels = result.metadata?.tags || [];
  const trustModelsArray = Array.isArray(trustModels) ? (trustModels as string[]) : [];
  const mcp = result.metadata?.mcp as boolean | undefined;
  const a2a = result.metadata?.a2a as boolean | undefined;
  const active = result.metadata?.active as boolean | undefined;
  const x402support = result.metadata?.x402support as boolean | undefined;
  
  const agentUrl = `/agents/${encodeURIComponent(result.agentId)}`;
  const description = result.description || 'No description available';
  const maxDescriptionLength = 120;
  const truncatedDescription = description.length > maxDescriptionLength 
    ? `${description.slice(0, maxDescriptionLength)}...` 
    : description;
  
  const imageUrl = agentImage || (result.metadata?.image as string | undefined);
  
  // Check for missing data - only warn if actually missing AND URIs have been loaded
  const warnings: string[] = [];
  const agentURI = result.metadata?.agentURI;
  
  // Only check for agentURI warnings if URIs have been loaded (prevents false warnings)
  if (agentURIsLoaded) {
    // Only warn if agentURI is missing, null, undefined, or empty string
    // Check if it's a valid non-empty string
    const hasValidURI = agentURI && 
      typeof agentURI === 'string' && 
      agentURI.trim() !== '' &&
      agentURI !== 'null' &&
      agentURI !== 'undefined';
    
    if (!hasValidURI) {
      warnings.push('Agent URI');
    }
  }
  // Only warn if description is missing or empty
  if (!result.description || (typeof result.description === 'string' && result.description.trim() === '')) {
    warnings.push('Description');
  }
  const hasMissingData = warnings.length > 0;
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const getChainColor = (chainId: number) => {
    const colors: Record<number, string> = {
      11155111: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      84532: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      80002: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    };
    return colors[chainId] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };
  
  const getTrustModelColor = (trust: string) => {
    const colors: Record<string, string> = {
      'reputation': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'crypto-economic': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'tee-attestation': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    };
    return colors[trust.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  return (
    <Link href={agentUrl} className="block h-full">
      <Card className="h-full hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 cursor-pointer group border-2 hover:border-primary/50 hover:-translate-y-1 bg-slate-900/60 backdrop-blur-sm border-slate-800/50">
        <CardContent className="p-4">
          {/* Header with Image and Basic Info */}
          <div className="flex items-start gap-3 mb-3">
            {imageUrl && !imageError ? (
              <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-border bg-slate-100 dark:bg-slate-800">
                <img
                  src={imageUrl}
                  alt={result.name || 'Agent'}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-border flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {(result.name || 'A')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-all duration-300 group-hover:scale-105 origin-left flex-1">
                  {result.name || `Agent ${formatAgentId(result.agentId)}`}
                </h3>
                {hasMissingData && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Missing: {warnings.join(', ')}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs font-mono ${getChainColor(result.chainId)}`}>
                  {getChainName(result.chainId).split(' ')[0]}
                </Badge>
                {active !== undefined && (
                  <Badge variant={active ? 'default' : 'secondary'} className="text-xs">
                    {active ? (
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
                )}
              </div>
            </div>
          </div>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2" title={description}>
            {truncatedDescription}
          </p>
          
          {/* Agent ID with Copy */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono text-muted-foreground">
              ID: {formatAgentId(result.agentId)}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={(e) => {
                    e.preventDefault();
                    copyToClipboard(result.agentId);
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{copied ? 'Copied!' : 'Copy Agent ID'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Score */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">Relevance Score</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search relevance: {(result.score * 100).toFixed(1)}%</p>
                </TooltipContent>
              </Tooltip>
              <span className="text-xs font-semibold">{(result.score * 100).toFixed(0)}%</span>
            </div>
            <Progress value={result.score * 100} className="h-2" />
          </div>
          
          {/* Protocol Support */}
          {(mcp || a2a || x402support) && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {mcp && (
                <Badge variant="secondary" className="text-xs">
                  <Code className="h-3 w-3 mr-1" />
                  MCP
                </Badge>
              )}
              {a2a && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  A2A
                </Badge>
              )}
              {x402support && (
                <Badge variant="secondary" className="text-xs">
                  x402
                </Badge>
              )}
            </div>
          )}
          
          {/* Capabilities */}
          {capabilitiesArray.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Capabilities</div>
              <div className="flex flex-wrap gap-1">
                {capabilitiesArray.slice(0, 3).map((cap, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs capitalize">
                    {cap}
                  </Badge>
                ))}
                {capabilitiesArray.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{capabilitiesArray.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {/* Trust Models */}
          {trustModelsArray.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Trust Models</div>
              <div className="flex flex-wrap gap-1">
                {trustModelsArray.map((trust, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={`text-xs ${getTrustModelColor(trust)}`}
                  >
                    {trust.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

