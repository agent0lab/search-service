'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
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
import type { StandardSearchResult, StandardSearchResponse, StandardFilters, StandardSearchRequest } from '@/lib/types';
import { AgentCard } from '@/components/agent/AgentCard';
import { LiquidEtherBackground } from '@/components/LiquidEtherBackground';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const STORAGE_KEY = 'agent-search-state';

interface StoredSearchState {
  query: string;
  results: StandardSearchResult[];
  selectedChainIds: number[];
  equalsFilters: Record<string, unknown>;
  inFilters: Record<string, unknown[]>;
  notInFilters: Record<string, unknown[]>;
  existsFields: string[];
  notExistsFields: string[];
  limit: number;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StandardSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [limit, setLimit] = useState(10);
  const [agentImages, setAgentImages] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [agentURIsLoaded, setAgentURIsLoaded] = useState(false);
  const lastSearchedQueryRef = useRef<string>('');
  
  // Pagination state
  const [offset, setOffset] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  
  // Filter state using standard operators only
  // equals filters (single values)
  const [equalsFilters, setEqualsFilters] = useState<Record<string, unknown>>({});
  
  // in filters (array values - multiple selection)
  const [inFilters, setInFilters] = useState<Record<string, unknown[]>>({});
  
  // notIn filters (exclusion)
  const [notInFilters, setNotInFilters] = useState<Record<string, unknown[]>>({});
  
  // exists filters (field must exist)
  const [existsFields, setExistsFields] = useState<string[]>([]);
  
  // notExists filters (field must not exist)
  const [notExistsFields, setNotExistsFields] = useState<string[]>([]);
  
  // Standard field: chainId (using standard operators)
  const [selectedChainIds, setSelectedChainIds] = useState<number[]>([]);

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
        
        // If URL has a different query than stored state, clear results and trigger search
        const urlQueryDiffers = urlQuery && urlQuery !== state.query;
        
        if (restoreQuery) {
          setQuery(restoreQuery);
          // Only restore chainIds if not set from URL
          if (!urlChainId) {
            setSelectedChainIds(state.selectedChainIds || []);
          }
          setEqualsFilters(state.equalsFilters || {});
          setInFilters(state.inFilters || {});
          setNotInFilters(state.notInFilters || {});
          setExistsFields(state.existsFields || []);
          setNotExistsFields(state.notExistsFields || []);
          setLimit(state.limit || 10);
          
          // If URL query differs, don't restore old results or set ref - will trigger search in next useEffect
          if (!urlQueryDiffers) {
            // Update ref to track the query we're restoring (only when query matches)
            lastSearchedQueryRef.current = restoreQuery;
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
          } else {
            // URL query differs - clear results and set loading, will trigger search in next useEffect
            setResults([]);
            setLoading(true);
            setError(null);
            setAgentURIsLoaded(false);
          }
        }
      } catch (e) {
        console.error('Failed to restore search state:', e);
      }
    } else if (urlQuery) {
      // New query from URL with no stored state - set loading, don't set ref yet, let auto-trigger handle it
      setQuery(urlQuery);
      setLoading(true);
      setError(null);
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
        equalsFilters,
        inFilters,
        notInFilters,
        existsFields,
        notExistsFields,
        limit,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [query, results, selectedChainIds, equalsFilters, inFilters, notInFilters, existsFields, notExistsFields, limit]);
  
  // Update URL only after a search is performed, not on every keystroke
  // This is handled in handleSearch instead
  
  // Available filter options - only supported chains
  const availableChainIds = [
    { id: 11155111, name: 'Ethereum Sepolia' },
    { id: 84532, name: 'Base Sepolia' },
    { id: 80002, name: 'Polygon Amoy' },
  ];

  const handleSearch = useCallback(async (useCursor = false, newOffset = 0) => {
    if (!query.trim()) {
      setResults([]);
      setHasMore(false);
      setTotal(0);
      return;
    }

    // Update URL when search is performed (only for new searches, not pagination)
    if (!useCursor && newOffset === 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('q', query);
      router.replace(`/search?${params.toString()}`, { scroll: false });
    }

    setLoading(true);
    setError(null);

    try {
      // Transform filters to v1 standard format (standard fields only)
      const filters: StandardFilters = {};
      
      // Chain IDs - use equals for single, in for multiple
      if (selectedChainIds.length > 0) {
        if (selectedChainIds.length === 1) {
          filters.equals = { ...filters.equals, chainId: selectedChainIds[0] };
        } else {
          filters.in = { ...filters.in, chainId: selectedChainIds };
        }
      }
      
      // Standard field filters from UI (active, x402support, etc.)
      if (Object.keys(equalsFilters).length > 0) {
        filters.equals = { ...filters.equals, ...equalsFilters };
      }
      
      // Custom in filters (for standard fields like supportedTrusts, mcpTools, etc.)
      if (Object.keys(inFilters).length > 0) {
        filters.in = { ...filters.in, ...inFilters };
      }
      
      // Custom notIn filters
      if (Object.keys(notInFilters).length > 0) {
        filters.notIn = notInFilters;
      }
      
      // Exists and notExists operators
      if (existsFields.length > 0) {
        filters.exists = existsFields;
      }
      if (notExistsFields.length > 0) {
        filters.notExists = notExistsFields;
      }

      // Build request with pagination
      const request: StandardSearchRequest = {
        query,
        limit: Math.min(limit, 10), // Max 10
        includeMetadata: true,
      };

      // Use cursor if available, otherwise fall back to offset-based pagination
      if (useCursor && cursor) {
        request.cursor = cursor;
      } else {
        // Fall back to offset-based pagination
        // If useCursor was true but cursor is null, calculate next offset from current state
        const effectiveOffset = useCursor && !cursor 
          ? offset + Math.min(limit, 10) // Next page offset
          : newOffset;
        request.offset = effectiveOffset;
        setOffset(effectiveOffset);
      }

      // Only include filters if we have any
      if (Object.keys(filters).length > 0) {
        request.filters = filters;
      }

      const response: StandardSearchResponse = await searchAgents(request);

      // Update ref to track the query we just searched (only for new searches)
      if (!useCursor && newOffset === 0) {
        lastSearchedQueryRef.current = query;
        // Reset results for new search
        setResults(response.results);
        setOffset(0);
        setCursor(null);
        setTotal(response.total);
      } else {
        // Append results for pagination (deduplicate by vectorId)
        setResults(prev => {
          const existingIds = new Set(prev.map(r => r.vectorId));
          const newResults = response.results.filter(r => !existingIds.has(r.vectorId));
          return [...prev, ...newResults];
        });
        // Don't update total when paginating - keep the original total
      }

      // Update pagination state
      if (response.pagination) {
        setHasMore(response.pagination.hasMore || false);
        if (response.pagination.nextCursor) {
          setCursor(response.pagination.nextCursor);
        }
        if (response.pagination.offset !== undefined) {
          setOffset(response.pagination.offset);
        }
      }
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
      if (!useCursor && newOffset === 0) {
        setResults([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [query, limit, selectedChainIds, equalsFilters, inFilters, notInFilters, existsFields, notExistsFields, cursor, router, searchParams]);

  // Auto-trigger search when URL query changes after initialization
  useEffect(() => {
    if (!hasInitialized) return;
    
    const urlQuery = searchParams.get('q');
    
    // If URL has a query and it's different from what we last searched, trigger search
    if (urlQuery && urlQuery.trim() && urlQuery !== lastSearchedQueryRef.current) {
      setQuery(urlQuery);
      // Set loading immediately to show loading state instead of "no results"
      setLoading(true);
      setError(null);
      // Use a ref to track that we're about to search this query
      lastSearchedQueryRef.current = urlQuery;
      // Small delay to ensure state is updated before search
      const timer = setTimeout(() => {
        handleSearch();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, hasInitialized, handleSearch]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSelectedChainIds([]);
    setEqualsFilters({});
    setInFilters({});
    setNotInFilters({});
    setExistsFields([]);
    setNotExistsFields([]);
    // Reset pagination
    setOffset(0);
    setCursor(null);
    setHasMore(false);
    setTotal(0);
  };

  const toggleChainId = (chainId: number) => {
    setSelectedChainIds(prev => 
      prev.includes(chainId) 
        ? prev.filter(id => id !== chainId)
        : [...prev, chainId]
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
                  {(selectedChainIds.length > 0 || Object.keys(equalsFilters).length > 0 || Object.keys(inFilters).length > 0 || Object.keys(notInFilters).length > 0 || existsFields.length > 0 || notExistsFields.length > 0) && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {selectedChainIds.length + Object.keys(equalsFilters).length + Object.keys(inFilters).length + Object.keys(notInFilters).length + existsFields.length + notExistsFields.length}
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
                      <Label className="text-sm font-medium">Blockchain Networks (chainId)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Filter agents by blockchain network. Uses <code className="text-xs">equals</code> for single, <code className="text-xs">in</code> for multiple.</p>
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
                        Advanced Filters (Standard Operators)
                      </Button>
                      {showAdvanced && (
                        <div className="space-y-4 mt-2 p-4 bg-muted/50 rounded-md">
                          <div className="mb-4">
                            <p className="text-xs text-muted-foreground mb-2">
                              These filters use the Universal Agent Semantic Search API Standard v1.0 operators:
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs mb-3">
                              <Badge variant="outline" className="font-mono">equals</Badge>
                              <Badge variant="outline" className="font-mono">in</Badge>
                              <Badge variant="outline" className="font-mono">notIn</Badge>
                              <Badge variant="outline" className="font-mono">exists</Badge>
                              <Badge variant="outline" className="font-mono">notExists</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <strong>Supported Standard Fields:</strong> id, cid, agentId, name, description, image, active, x402support, supportedTrusts, mcpEndpoint, mcpVersion, a2aEndpoint, a2aVersion, ens, did, agentWallet, agentWalletChainId, mcpTools, mcpPrompts, mcpResources, a2aSkills, chainId, createdAt
                            </p>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Standard Field Filters</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="activeFilter" className="text-xs">Active Status</Label>
                                <Select
                                  value={equalsFilters.active !== undefined ? String(equalsFilters.active) : 'all'}
                                  onValueChange={(value) => {
                                    if (value === 'all') {
                                      const rest = { ...equalsFilters };
                                      delete rest.active;
                                      setEqualsFilters(rest);
                                    } else {
                                      setEqualsFilters({ ...equalsFilters, active: value === 'true' });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-full mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="true">Active only</SelectItem>
                                    <SelectItem value="false">Inactive only</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Uses <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">equals</code> operator
                                </p>
                              </div>
                              
                              <div>
                                <Label htmlFor="x402supportFilter" className="text-xs">x402 Support</Label>
                                <Select
                                  value={equalsFilters.x402support !== undefined ? String(equalsFilters.x402support) : 'all'}
                                  onValueChange={(value) => {
                                    if (value === 'all') {
                                      const rest = { ...equalsFilters };
                                      delete rest.x402support;
                                      setEqualsFilters(rest);
                                    } else {
                                      setEqualsFilters({ ...equalsFilters, x402support: value === 'true' });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-full mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="true">Has x402 support</SelectItem>
                                    <SelectItem value="false">No x402 support</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Uses <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">equals</code> operator
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Field Existence Filters</Label>
                            <div className="space-y-2">
                              <div>
                                <Label htmlFor="existsFields" className="text-xs">Fields that must exist (comma-separated)</Label>
                                <Input
                                  id="existsFields"
                                  type="text"
                                  placeholder="e.g., mcpEndpoint, a2aEndpoint, agentWallet"
                                  value={existsFields.join(', ')}
                                  onChange={(e) => {
                                    const fields = e.target.value.split(',').map(f => f.trim()).filter(f => f);
                                    setExistsFields(fields);
                                  }}
                                  className="mt-1"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Uses <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">exists</code> operator. Standard fields: mcpEndpoint, a2aEndpoint, ens, did, agentWallet, etc.
                                </p>
                              </div>
                              <div>
                                <Label htmlFor="notExistsFields" className="text-xs">Fields that must not exist (comma-separated)</Label>
                                <Input
                                  id="notExistsFields"
                                  type="text"
                                  placeholder="e.g., deprecated, archived"
                                  value={notExistsFields.join(', ')}
                                  onChange={(e) => {
                                    const fields = e.target.value.split(',').map(f => f.trim()).filter(f => f);
                                    setNotExistsFields(fields);
                                  }}
                                  className="mt-1"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Uses <code className="text-xs bg-slate-900/60 px-1 py-0.5 rounded">notExists</code> operator
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Custom Standard Field Filters</Label>
                            <div className="space-y-2">
                              <div>
                                <Label htmlFor="customEquals" className="text-xs">Equals Filters (JSON format)</Label>
                                <Input
                                  id="customEquals"
                                  type="text"
                                  placeholder='e.g., {"name": "MyAgent"}'
                                  value={JSON.stringify(equalsFilters).replace(/[{}"]/g, '').replace(/:/g, ': ')}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(`{${e.target.value}}`);
                                      setEqualsFilters(parsed);
                                    } catch {
                                      // Invalid JSON, ignore
                                    }
                                  }}
                                  className="mt-1 font-mono text-xs"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Add custom equals filters for any supported field (e.g., name, agentId, ens, did)
                                </p>
                              </div>
                              <div>
                                <Label htmlFor="customIn" className="text-xs">In Filters (JSON format)</Label>
                                <Input
                                  id="customIn"
                                  type="text"
                                  placeholder='e.g., {"supportedTrusts": ["reputation", "crypto-economic"]}'
                                  value={JSON.stringify(inFilters).replace(/[{}"]/g, '').replace(/:/g, ': ')}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(`{${e.target.value}}`);
                                      setInFilters(parsed);
                                    } catch {
                                      // Invalid JSON, ignore
                                    }
                                  }}
                                  className="mt-1 font-mono text-xs"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Add custom in filters for array fields (e.g., supportedTrusts, mcpTools, a2aSkills)
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Active Standard Filters (JSON)</Label>
                            <div className="text-xs space-y-1 p-2 bg-slate-900/40 rounded border border-slate-800/50 font-mono max-h-40 overflow-y-auto">
                              {(() => {
                                const filters: StandardFilters = {};
                                
                                // Chain IDs
                                if (selectedChainIds.length === 1) {
                                  filters.equals = { ...filters.equals, chainId: selectedChainIds[0] };
                                } else if (selectedChainIds.length > 1) {
                                  filters.in = { ...filters.in, chainId: selectedChainIds };
                                }
                                
                                // Standard field filters from UI
                                if (Object.keys(equalsFilters).length > 0) {
                                  filters.equals = { ...filters.equals, ...equalsFilters };
                                }
                                if (Object.keys(inFilters).length > 0) {
                                  filters.in = { ...filters.in, ...inFilters };
                                }
                                if (Object.keys(notInFilters).length > 0) {
                                  filters.notIn = notInFilters;
                                }
                                
                                // Exists and notExists
                                if (existsFields.length > 0) {
                                  filters.exists = existsFields;
                                }
                                if (notExistsFields.length > 0) {
                                  filters.notExists = notExistsFields;
                                }
                                
                                return Object.keys(filters).length > 0 ? (
                                  <pre className="text-xs whitespace-pre-wrap break-words text-slate-100">
                                    {JSON.stringify(filters, null, 2)}
                                  </pre>
                                ) : (
                                  <span className="text-muted-foreground">No filters applied</span>
                                );
                              })()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              This is the exact filter format sent to the API using standard operators.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Limit */}
                    <div>
                      <Label htmlFor="limit" className="text-sm font-medium">Results per Page</Label>
                      <Input
                        id="limit"
                        type="number"
                        min="1"
                        max="10"
                        value={limit}
                        onChange={(e) => setLimit(Math.min(Math.max(1, parseInt(e.target.value, 10) || 1), 10))}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum 10 results per page
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              onClick={() => handleSearch(false, 0)} 
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
                  {total > 0 ? (
                    <>Showing {results.length} of {total} result{total !== 1 ? 's' : ''}</>
                  ) : (
                    <>Found {results.length} result{results.length !== 1 ? 's' : ''}</>
                  )}
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
                  <AgentCard
                    key={result.vectorId || `${result.chainId}-${result.agentId}-${index}`}
                    result={result}
                    agentImage={agentImages[result.agentId]}
                    getChainName={getChainName}
                    formatAgentId={formatAgentId}
                    agentURIsLoaded={agentURIsLoaded}
                  />
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
                        {results.map((result, index) => {
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
                              key={result.vectorId || `${result.chainId}-${result.agentId}-${index}`} 
                              className="hover:bg-muted/50 cursor-pointer"
                              onClick={() => {
                                const state: StoredSearchState = {
                                  query,
                                  results,
                                  selectedChainIds,
                                  equalsFilters,
                                  inFilters,
                                  notInFilters,
                                  existsFields,
                                  notExistsFields,
                                  limit,
                                };
                                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                                router.push(agentUrl);
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

            {/* Pagination Controls */}
            {(hasMore || offset > 0) && (
              <div className="mt-6 flex items-center justify-center gap-4">
                {offset > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newOffset = Math.max(0, offset - limit);
                      setResults([]);
                      setCursor(null);
                      handleSearch(false, newOffset);
                    }}
                    disabled={loading}
                  >
                    Previous
                  </Button>
                )}
                {hasMore && (
                  <Button
                    onClick={() => handleSearch(true, 0)}
                    disabled={loading}
                    className="min-w-[120px]"
                  >
                    {loading ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                )}
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


