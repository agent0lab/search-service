'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Filter, X, ChevronDown, ChevronUp, LayoutGrid, Table as TableIcon, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { searchAgents } from '@/lib/search-client';
import type { SemanticSearchResult, SemanticSearchFilters } from '@/lib/types';
import Link from 'next/link';
import { AgentCard } from '@/components/agent/AgentCard';
import { LiquidEtherBackground } from '@/components/LiquidEtherBackground';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const STORAGE_KEY = 'agent-search-state';

interface StoredSearchState {
  query: string;
  results: SemanticSearchResult[];
  selectedChainIds: number[];
  selectedCapabilities: string[];
  selectedInputModes: string[];
  selectedOutputModes: string[];
  selectedTags: string[];
  customTags: string;
  customCapabilities: string;
  topK: number;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [topK, setTopK] = useState(10);
  const [agentImages, setAgentImages] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [agentURIsLoaded, setAgentURIsLoaded] = useState(false);
  
  // Filter state - using arrays for multiple selection
  const [selectedChainIds, setSelectedChainIds] = useState<number[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [selectedInputModes, setSelectedInputModes] = useState<string[]>([]);
  const [selectedOutputModes, setSelectedOutputModes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Advanced filters - custom tags and capabilities
  const [customTags, setCustomTags] = useState<string>('');
  const [customCapabilities, setCustomCapabilities] = useState<string>('');

  // Restore view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('agent-view-mode') as 'card' | 'table' | null;
    if (savedViewMode === 'card' || savedViewMode === 'table') {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem('agent-view-mode', viewMode);
  }, [viewMode]);

  // Restore state from URL params or sessionStorage on mount (only once)
  useEffect(() => {
    if (hasInitialized) return; // Only run once
    
    const urlQuery = searchParams.get('q');
    const urlChainId = searchParams.get('chainId');
    const storedState = sessionStorage.getItem(STORAGE_KEY);
    
    // Check for chainId in URL and set it
    if (urlChainId) {
      const chainIdNum = parseInt(urlChainId, 10);
      if (!isNaN(chainIdNum)) {
        setSelectedChainIds([chainIdNum]);
      }
    }
    
    if (storedState) {
      try {
        const state: StoredSearchState = JSON.parse(storedState);
        const restoreQuery = urlQuery || state.query;
        if (restoreQuery) {
          setQuery(restoreQuery);
          // Only restore chainIds if not set from URL
          if (!urlChainId) {
            setSelectedChainIds(state.selectedChainIds || []);
          }
          setSelectedCapabilities(state.selectedCapabilities || []);
          setSelectedInputModes(state.selectedInputModes || []);
          setSelectedOutputModes(state.selectedOutputModes || []);
          setSelectedTags(state.selectedTags || []);
          setCustomTags(state.customTags || '');
          setCustomCapabilities(state.customCapabilities || '');
          setTopK(state.topK || 10);
          
          // Enrich restored results with agentURI
          if (state.results && state.results.length > 0) {
            (async () => {
              // Use batch endpoint for faster loading
              try {
                const batchResponse = await fetch('/api/agents/batch', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    agentIds: state.results.map(r => r.agentId),
                  }),
                });

                if (batchResponse.ok) {
                  const batchData = await batchResponse.json() as { agents: Array<{ agentId: string; agentURI?: string; image?: string }> };
                  
                  const imagesMap: Record<string, string> = {};
                  const agentURIMap: Record<string, string> = {};
                  
                  batchData.agents.forEach((agent) => {
                    if (agent.image) {
                      imagesMap[agent.agentId] = agent.image;
                    }
                    if (agent.agentURI && typeof agent.agentURI === 'string' && agent.agentURI.trim() !== '') {
                      agentURIMap[agent.agentId] = agent.agentURI;
                    }
                  });
                  
                  setAgentImages(imagesMap);
                  
                  // Enrich results with agentURI
                  const enrichedResults = state.results.map(result => {
                    const fetchedURI = agentURIMap[result.agentId];
                    const existingURI = result.metadata?.agentURI;
                    let finalURI: string | undefined = undefined;
                    
                    if (fetchedURI && typeof fetchedURI === 'string' && fetchedURI.trim() !== '') {
                      finalURI = fetchedURI;
                    } else if (existingURI && typeof existingURI === 'string' && existingURI.trim() !== '') {
                      finalURI = existingURI;
                    }
                    
                    const metadata = result.metadata || {};
                    return {
                      ...result,
                      metadata: {
                        ...metadata,
                        agentURI: finalURI,
                      },
                    };
                  });
                  
                  setResults(enrichedResults);
                  setAgentURIsLoaded(true);
                } else {
                  setResults(state.results || []);
                  setAgentURIsLoaded(true);
                }
              } catch (error) {
                console.error('Failed to enrich restored results:', error);
                setResults(state.results || []);
                setAgentURIsLoaded(true);
              }
            })();
          } else {
            setResults(state.results || []);
            setAgentURIsLoaded(true);
          }
        }
      } catch (e) {
        console.error('Failed to restore search state:', e);
      }
    } else if (urlQuery) {
      setQuery(urlQuery);
    }
    
    setHasInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount


  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    if (query || results.length > 0) {
      const state: StoredSearchState = {
        query,
        results,
        selectedChainIds,
        selectedCapabilities,
        selectedInputModes,
        selectedOutputModes,
        selectedTags,
        customTags,
        customCapabilities,
        topK,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [query, results, selectedChainIds, selectedCapabilities, selectedInputModes, selectedOutputModes, selectedTags, customTags, customCapabilities, topK]);
  
  // Update URL only after a search is performed, not on every keystroke
  // This is handled in handleSearch instead
  
  // Available filter options - only supported chains
  const availableChainIds = [
    { id: 11155111, name: 'Ethereum Sepolia' },
    { id: 84532, name: 'Base Sepolia' },
    { id: 80002, name: 'Polygon Amoy' },
  ];
  
  const availableCapabilities = ['defi', 'nft', 'gaming', 'ai', 'data', 'finance', 'tools', 'analytics', 'trading', 'oracle'];
  const availableInputModes = ['text', 'json', 'image', 'audio', 'multimodal'];
  const availableOutputModes = ['text', 'json', 'image', 'audio', 'multimodal'];
  const availableTags = ['reputation', 'crypto-economic', 'tee-attestation'];

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Update URL when search is performed
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', query);
    router.replace(`/search?${params.toString()}`, { scroll: false });

    setLoading(true);
    setError(null);

    try {
      const filters: SemanticSearchFilters = {};
      
      // Chain IDs - use $in format for multiple
      if (selectedChainIds.length > 0) {
        if (selectedChainIds.length === 1) {
          filters.chainId = selectedChainIds[0];
        } else {
          filters.chainId = { $in: selectedChainIds };
        }
      }
      
      // Capabilities - combine selected and custom
      const allCapabilities = [...selectedCapabilities];
      if (customCapabilities.trim()) {
        const custom = customCapabilities.split(',').map(c => c.trim()).filter(c => c);
        allCapabilities.push(...custom);
      }
      if (allCapabilities.length > 0) {
        filters.capabilities = allCapabilities;
      }
      
      // Input/Output modes - single selection (first selected)
      if (selectedInputModes.length > 0) {
        filters.defaultInputMode = selectedInputModes[0];
      }
      if (selectedOutputModes.length > 0) {
        filters.defaultOutputMode = selectedOutputModes[0];
      }
      
      // Tags - combine selected and custom
      const allTags = [...selectedTags];
      if (customTags.trim()) {
        const custom = customTags.split(',').map(t => t.trim()).filter(t => t);
        allTags.push(...custom);
      }
      if (allTags.length > 0) {
        filters.tags = allTags;
      }

      const response = await searchAgents({
        query,
        topK: Math.min(topK, 10), // Max 10
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      // Show results immediately for fast UI
      setResults(response.results);
      setAgentURIsLoaded(false); // Reset flag when new search starts
      
      // Enrich results in the background (non-blocking) using batch endpoint
      (async () => {
        try {
          // Fetch all agentURIs and images in a single batch request
          const batchResponse = await fetch('/api/agents/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agentIds: response.results.map(r => r.agentId),
            }),
          });

          if (batchResponse.ok) {
            const batchData = await batchResponse.json() as { agents: Array<{ agentId: string; agentURI?: string; image?: string }> };
            
            const imagesMap: Record<string, string> = {};
            const agentURIMap: Record<string, string> = {};
            
            batchData.agents.forEach((agent) => {
              if (agent.image) {
                imagesMap[agent.agentId] = agent.image;
              }
              if (agent.agentURI && typeof agent.agentURI === 'string' && agent.agentURI.trim() !== '') {
                agentURIMap[agent.agentId] = agent.agentURI;
              }
            });
            
            setAgentImages(imagesMap);
            
            // Enrich results with agentURI and update state
            setResults(prevResults => {
              return prevResults.map(result => {
                const fetchedURI = agentURIMap[result.agentId];
                const existingURI = result.metadata?.agentURI;
                
                // Use fetched URI if available, otherwise use existing, but only if it's a valid non-empty string
                let finalURI: string | undefined = undefined;
                
                if (fetchedURI && typeof fetchedURI === 'string' && fetchedURI.trim() !== '') {
                  finalURI = fetchedURI;
                } else if (existingURI && typeof existingURI === 'string' && existingURI.trim() !== '') {
                  finalURI = existingURI;
                }
                
                // Ensure metadata object exists
                const metadata = result.metadata || {};
                
                return {
                  ...result,
                  metadata: {
                    ...metadata,
                    agentURI: finalURI,
                  },
                };
              });
            });
            
            // Mark URIs as loaded so warnings can be shown
            setAgentURIsLoaded(true);
          } else {
            // Even if batch fails, mark as loaded so we don't show false warnings
            setAgentURIsLoaded(true);
          }
        } catch (error) {
          console.error('[Search] Failed to fetch batch agent data:', error);
          // Mark as loaded even on error to avoid false warnings
          setAgentURIsLoaded(true);
        }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, topK, selectedChainIds, selectedCapabilities, selectedInputModes, selectedOutputModes, selectedTags, customTags, customCapabilities, router, searchParams]);


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSelectedChainIds([]);
    setSelectedCapabilities([]);
    setSelectedInputModes([]);
    setSelectedOutputModes([]);
    setSelectedTags([]);
    setCustomTags('');
    setCustomCapabilities('');
  };

  const toggleChainId = (chainId: number) => {
    setSelectedChainIds(prev => 
      prev.includes(chainId) 
        ? prev.filter(id => id !== chainId)
        : [...prev, chainId]
    );
  };

  const toggleCapability = (capability: string) => {
    setSelectedCapabilities(prev => 
      prev.includes(capability)
        ? prev.filter(c => c !== capability)
        : [...prev, capability]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };


  const getChainName = (chainId: number) => {
    const chain = availableChainIds.find(c => c.id === chainId);
    return chain ? chain.name : `Chain ${chainId}`;
  };

  const formatAgentId = (agentId: string) => {
    const parts = agentId.split(':');
    return parts.length > 1 ? `#${parts[1]}` : `#${agentId}`;
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      <LiquidEtherBackground />
      <Header />

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative group">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 transition-colors group-focus-within:text-primary" />
              <Input
                type="text"
                placeholder="Search by description, capabilities, or use natural language..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <Dialog open={showFilters} onOpenChange={setShowFilters}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Advanced Filters
                  {(selectedChainIds.length > 0 || selectedCapabilities.length > 0 || selectedTags.length > 0 || selectedInputModes.length > 0 || selectedOutputModes.length > 0) && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {selectedChainIds.length + selectedCapabilities.length + selectedTags.length + selectedInputModes.length + selectedOutputModes.length}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Advanced Filters</DialogTitle>
                  <DialogDescription className="text-base">
                    Filter agents by blockchain network, capabilities, trust models, and more
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Filter Options</h3>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Blockchain Networks */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-medium">Blockchain Networks</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Filter agents by blockchain network</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          <span>
                            {selectedChainIds.length === 0
                              ? 'All networks'
                              : selectedChainIds.length === 1
                              ? availableChainIds.find(c => c.id === selectedChainIds[0])?.name || 'Selected'
                              : `${selectedChainIds.length} selected`}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {availableChainIds.map((chain) => (
                            <div key={chain.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`chain-${chain.id}`}
                                checked={selectedChainIds.includes(chain.id)}
                                onCheckedChange={() => toggleChainId(chain.id)}
                              />
                              <Label
                                htmlFor={`chain-${chain.id}`}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                {chain.name} ({chain.id})
                              </Label>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedChainIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedChainIds.map((id) => {
                          const chain = availableChainIds.find(c => c.id === id);
                          return chain ? (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {chain.name}
                              <button
                                onClick={() => toggleChainId(id)}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Capabilities */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-medium">Capabilities</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Filter by agent capabilities (e.g., DeFi, NFT, Gaming)</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          <span>
                            {selectedCapabilities.length === 0
                              ? 'All capabilities'
                              : selectedCapabilities.length === 1
                              ? selectedCapabilities[0].charAt(0).toUpperCase() + selectedCapabilities[0].slice(1)
                              : `${selectedCapabilities.length} selected`}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                          {availableCapabilities.map((cap) => (
                            <div key={cap} className="flex items-center space-x-2">
                              <Checkbox
                                id={`cap-${cap}`}
                                checked={selectedCapabilities.includes(cap)}
                                onCheckedChange={() => toggleCapability(cap)}
                              />
                              <Label
                                htmlFor={`cap-${cap}`}
                                className="text-sm font-normal cursor-pointer capitalize flex-1"
                              >
                                {cap}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedCapabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedCapabilities.map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-xs capitalize">
                            {cap}
                            <button
                              onClick={() => toggleCapability(cap)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input Mode */}
                  <div>
                    <Label className="mb-2 block text-sm font-medium">Input Mode</Label>
                    <Select
                      value={selectedInputModes.length > 0 ? selectedInputModes[0] : 'all'}
                      onValueChange={(value) => {
                        if (value === 'all') {
                          setSelectedInputModes([]);
                        } else {
                          setSelectedInputModes([value]);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {selectedInputModes.length === 0
                            ? 'All input modes'
                            : selectedInputModes[0].charAt(0).toUpperCase() + selectedInputModes[0].slice(1)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All input modes</SelectItem>
                        {availableInputModes.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Output Mode */}
                  <div>
                    <Label className="mb-2 block text-sm font-medium">Output Mode</Label>
                    <Select
                      value={selectedOutputModes.length > 0 ? selectedOutputModes[0] : 'all'}
                      onValueChange={(value) => {
                        if (value === 'all') {
                          setSelectedOutputModes([]);
                        } else {
                          setSelectedOutputModes([value]);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {selectedOutputModes.length === 0
                            ? 'All output modes'
                            : selectedOutputModes[0].charAt(0).toUpperCase() + selectedOutputModes[0].slice(1)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All output modes</SelectItem>
                        {availableOutputModes.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tags (Trust Models) */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm font-medium">Trust Models</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Filter by trust model type (reputation, crypto-economic, TEE)</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          <span>
                            {selectedTags.length === 0
                              ? 'All trust models'
                              : selectedTags.length === 1
                              ? selectedTags[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
                              : `${selectedTags.length} selected`}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {availableTags.map((tag) => {
                            const displayName = tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
                            const descriptions: Record<string, string> = {
                              'reputation': 'Reputation-based trust',
                              'crypto-economic': 'Crypto-economic incentives',
                              'tee-attestation': 'TEE (Trusted Execution Environment) attestation',
                            };
                            return (
                              <div key={tag} className="flex items-start space-x-2">
                                <Checkbox
                                  id={`tag-${tag}`}
                                  checked={selectedTags.includes(tag)}
                                  onCheckedChange={() => toggleTag(tag)}
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`tag-${tag}`}
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  <div className="font-medium">{displayName}</div>
                                  {descriptions[tag] && (
                                    <div className="text-xs text-muted-foreground">{descriptions[tag]}</div>
                                  )}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs capitalize">
                            {tag}
                            <button
                              onClick={() => toggleTag(tag)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                    {/* Advanced Filters */}
                    <div className="md:col-span-2">
                      <Separator className="my-4" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="mb-3"
                      >
                        {showAdvanced ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                        Advanced Filters
                      </Button>
                      {showAdvanced && (
                        <div className="space-y-4 mt-2 p-4 bg-muted/50 rounded-md">
                          <div>
                            <Label htmlFor="customTags" className="text-sm">Custom Trust Models (comma-separated)</Label>
                            <Input
                              id="customTags"
                              type="text"
                              placeholder="e.g., reputation, crypto-economic"
                              value={customTags}
                              onChange={(e) => setCustomTags(e.target.value)}
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Add custom trust models separated by commas
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="customCapabilities" className="text-sm">Custom Capabilities (comma-separated)</Label>
                            <Input
                              id="customCapabilities"
                              type="text"
                              placeholder="e.g., defi, nft"
                              value={customCapabilities}
                              onChange={(e) => setCustomCapabilities(e.target.value)}
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Add custom capabilities separated by commas
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Top K */}
                    <div>
                      <Label htmlFor="topK" className="text-sm font-medium">Results (Top K)</Label>
                      <Input
                        id="topK"
                        type="number"
                        min="1"
                        max="10"
                        value={topK}
                        onChange={(e) => setTopK(Math.min(Math.max(1, parseInt(e.target.value, 10) || 1), 10))}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum 10 results
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              onClick={handleSearch} 
              disabled={loading} 
              className="h-11 px-6 transition-all hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            >
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <Card className="border-destructive bg-destructive/5 shadow-lg">
              <CardContent className="p-4">
                <p className="text-destructive font-medium">{error}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div>
            {/* Results Header with View Toggle */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">
                  Search Results
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Found {results.length} result{results.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'card' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('card')}
                    >
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Card
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Card view - See agent details in cards</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                    >
                      <TableIcon className="h-4 w-4 mr-2" />
                      Table
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Table view - Compact list format</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Card View */}
            {viewMode === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.map((result, index) => (
                  <div 
                    key={result.vectorId}
                    className="animate-in fade-in-0 slide-in-from-bottom-4"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                  >
                    <AgentCard
                      result={result}
                      agentImage={agentImages[result.agentId]}
                      getChainName={getChainName}
                      formatAgentId={formatAgentId}
                      agentURIsLoaded={agentURIsLoaded}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto">
                <Card className="bg-slate-900/40 backdrop-blur-md border-slate-800/40">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[35%]">Agent</TableHead>
                          <TableHead className="w-[10%]">ID</TableHead>
                          <TableHead className="w-[10%]">Chain</TableHead>
                          <TableHead className="w-[10%]">Score</TableHead>
                          <TableHead className="w-[15%]">Capabilities</TableHead>
                          <TableHead className="w-[10%]">Trust Models</TableHead>
                          <TableHead className="w-[10%]">Protocols</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((result) => {
                          const capabilities = result.metadata?.capabilities;
                          const capabilitiesArray = Array.isArray(capabilities) ? (capabilities as string[]) : [];
                          const trustModels = result.metadata?.tags || [];
                          const trustModelsArray = Array.isArray(trustModels) ? (trustModels as string[]) : [];
                          const mcp = result.metadata?.mcp as boolean | undefined;
                          const a2a = result.metadata?.a2a as boolean | undefined;
                          const agentUrl = `/agents/${encodeURIComponent(result.agentId)}`;
                          const description = result.description || 'No description available';
                          const maxDescriptionLength = 80;
                          const truncatedDescription = description.length > maxDescriptionLength 
                            ? `${description.slice(0, maxDescriptionLength)}...` 
                            : description;
                          
                          return (
                            <TableRow 
                              key={result.vectorId} 
                              className="hover:bg-muted/50 cursor-pointer"
                              onClick={() => {
                                const state: StoredSearchState = {
                                  query,
                                  results,
                                  selectedChainIds,
                                  selectedCapabilities,
                                  selectedInputModes,
                                  selectedOutputModes,
                                  selectedTags,
                                  customTags,
                                  customCapabilities,
                                  topK,
                                };
                                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                                window.location.href = agentUrl;
                              }}
                            >
                              <TableCell className="w-[35%]">
                                <div className="flex items-start gap-2">
                                  {(() => {
                                    const imageUrl = agentImages[result.agentId] || (result.metadata?.image as string | undefined);
                                    if (imageUrl) {
                                      return (
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border bg-slate-200 dark:bg-slate-700">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={imageUrl}
                                            alt={result.name || 'Agent'}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.style.display = 'none';
                                              const parent = target.parentElement;
                                              if (parent) {
                                                parent.innerHTML = `<span class="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-center w-full h-full">${(result.name || 'A')[0].toUpperCase()}</span>`;
                                              }
                                            }}
                                          />
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                          {(result.name || 'A')[0].toUpperCase()}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <div className="font-semibold text-sm text-foreground truncate flex-1">
                                        {result.name || `Agent ${formatAgentId(result.agentId)}`}
                                      </div>
                                      {(() => {
                                        // Only show warnings after URIs have been loaded (prevents false warnings)
                                        if (!agentURIsLoaded) return null;
                                        
                                        const warnings: string[] = [];
                                        const agentURI = result.metadata?.agentURI;
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
                                        // Only warn if description is missing or empty
                                        if (!result.description || (typeof result.description === 'string' && result.description.trim() === '')) {
                                          warnings.push('Description');
                                        }
                                        const hasMissingData = warnings.length > 0;
                                        
                                        return hasMissingData ? (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0 cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs">Missing: {warnings.join(', ')}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : null;
                                      })()}
                                    </div>
                                    <div 
                                      className="text-xs text-muted-foreground line-clamp-1 break-words"
                                      title={description}
                                    >
                                      {truncatedDescription}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="w-[10%]">
                                <span className="font-mono text-xs">{formatAgentId(result.agentId)}</span>
                              </TableCell>
                              <TableCell className="w-[10%]">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {getChainName(result.chainId).split(' ')[0]}
                                </Badge>
                              </TableCell>
                              <TableCell className="w-[10%]">
                                <span className="text-xs font-medium">{(result.score * 100).toFixed(0)}%</span>
                              </TableCell>
                              <TableCell className="w-[15%]">
                                {capabilitiesArray.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {capabilitiesArray.slice(0, 2).map((cap, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0">
                                        {cap}
                                      </Badge>
                                    ))}
                                    {capabilitiesArray.length > 2 && (
                                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                        +{capabilitiesArray.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="w-[10%]">
                                {trustModelsArray.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {trustModelsArray.slice(0, 1).map((trust, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                                        {trust.split('-')[0]}
                                      </Badge>
                                    ))}
                                    {trustModelsArray.length > 1 && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                                        +{trustModelsArray.length - 1}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="w-[10%]">
                                <div className="flex items-center gap-1">
                                  {mcp && <Badge variant="secondary" className="text-xs">MCP</Badge>}
                                  {a2a && <Badge variant="secondary" className="text-xs">A2A</Badge>}
                                  {!mcp && !a2a && <span className="text-muted-foreground text-xs">-</span>}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Loading State - only show when loading and no results */}
        {loading && results.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Skeleton className="h-16 w-16 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3 mb-3" />
                    <Skeleton className="h-2 w-full mb-3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && query && !error && (
          <Card className="border-dashed animate-in fade-in-0 zoom-in-95 duration-500">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-gradient-to-br from-muted to-muted/50 p-4 mb-6 shadow-lg">
                <Search className="h-8 w-8 text-muted-foreground animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                No results found
              </h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Try adjusting your search query or filters to find more agents.
              </p>
              <Button 
                variant="outline" 
                onClick={clearFilters}
                className="transition-all hover:scale-105 active:scale-95"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Initial State - Prompt for search */}
        {!loading && results.length === 0 && !query && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-gradient-to-br from-muted to-muted/50 p-4 mb-6 shadow-lg">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Start searching for agents
              </h3>
              <p className="text-muted-foreground text-center max-w-md">
                Enter a search query above to find agents by description, capabilities, or use natural language.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      
      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

