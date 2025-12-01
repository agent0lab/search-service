'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { searchAgents } from '@/lib/search-client';
import type { SemanticSearchResult, SemanticSearchFilters } from '@/lib/types';
import Link from 'next/link';

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

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [topK, setTopK] = useState(10);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [agentImages, setAgentImages] = useState<Record<string, string>>({});
  
  // Filter state - using arrays for multiple selection
  const [selectedChainIds, setSelectedChainIds] = useState<number[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [selectedInputModes, setSelectedInputModes] = useState<string[]>([]);
  const [selectedOutputModes, setSelectedOutputModes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Advanced filters - custom tags and capabilities
  const [customTags, setCustomTags] = useState<string>('');
  const [customCapabilities, setCustomCapabilities] = useState<string>('');
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setOpenDropdowns({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Restore state from URL params or sessionStorage on mount
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    const storedState = sessionStorage.getItem(STORAGE_KEY);
    
    if (storedState) {
      try {
        const state: StoredSearchState = JSON.parse(storedState);
        // Only restore if we have a query (either from URL or stored)
        const restoreQuery = urlQuery || state.query;
        if (restoreQuery) {
          setQuery(restoreQuery);
          setResults(state.results || []);
          setSelectedChainIds(state.selectedChainIds || []);
          setSelectedCapabilities(state.selectedCapabilities || []);
          setSelectedInputModes(state.selectedInputModes || []);
          setSelectedOutputModes(state.selectedOutputModes || []);
          setSelectedTags(state.selectedTags || []);
          setCustomTags(state.customTags || '');
          setCustomCapabilities(state.customCapabilities || '');
          setTopK(state.topK || 10);
          
          // If we have URL query but no stored results, trigger search
          if (urlQuery && (!state.results || state.results.length === 0)) {
            // Will trigger search via the query change effect
          }
        }
      } catch (e) {
        console.error('Failed to restore search state:', e);
      }
    } else if (urlQuery) {
      // URL has query but no stored state - set query to trigger search
      setQuery(urlQuery);
    }
  }, [searchParams]);
  
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
  
  // Update URL when query changes
  useEffect(() => {
    if (query) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('q', query);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [query, router, searchParams]);
  
  // Available filter options - only supported chains
  const availableChainIds = [
    { id: 11155111, name: 'Ethereum Sepolia' },
    { id: 84532, name: 'Base Sepolia' },
    { id: 80002, name: 'Polygon Amoy' },
  ];
  
  const availableCapabilities = ['defi', 'nft', 'gaming', 'ai', 'data', 'finance', 'tools', 'analytics', 'trading', 'oracle'];
  const availableInputModes = ['text', 'json', 'image', 'audio', 'multimodal'];
  const availableOutputModes = ['text', 'json', 'image', 'audio', 'multimodal'];
  // Tags are actually trust models from agent registration (supportedTrusts)
  const availableTags = ['reputation', 'crypto-economic', 'tee-attestation'];

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

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

      setResults(response.results);

      // Fetch agent images for all results
      const imagePromises = response.results.map(async (result) => {
        try {
          const agentResponse = await fetch(`/api/agents/${encodeURIComponent(result.agentId)}`);
          if (agentResponse.ok) {
            const agentData = await agentResponse.json() as { image?: string };
            if (agentData.image) {
              return { agentId: result.agentId, image: agentData.image };
            }
          }
        } catch {
          // Silently fail - just don't show image
        }
        return null;
      });

      const imageResults = await Promise.all(imagePromises);
      const imagesMap: Record<string, string> = {};
      imageResults.forEach((result) => {
        if (result) {
          imagesMap[result.agentId] = result.image;
        }
      });
      setAgentImages(imagesMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, topK, selectedChainIds, selectedCapabilities, selectedInputModes, selectedOutputModes, selectedTags, customTags, customCapabilities]);

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

  // Check if user is authenticated for admin link
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json() as Promise<{ authenticated: boolean }>)
      .then((data) => setIsAuthenticated(data.authenticated));
  }, []);

  const getChainName = (chainId: number) => {
    const chain = availableChainIds.find(c => c.id === chainId);
    return chain ? chain.name : `Chain ${chainId}`;
  };

  const formatAgentId = (agentId: string) => {
    const parts = agentId.split(':');
    return parts.length > 1 ? `#${parts[1]}` : `#${agentId}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-800 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Agent Search Dashboard</h1>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button variant="outline" size="sm">
                    Admin
                  </Button>
                </Link>
              ) : (
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Admin
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Search Agents</h2>
          <p className="text-muted-foreground mb-4">
            Browse and discover AI agents registered on the ERC-8004 protocol
          </p>
          {results.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder="Search by description, capabilities, or use natural language..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 h-11"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="h-11"
            >
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
              {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
            <Button onClick={handleSearch} disabled={loading} className="h-11 px-6">
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card className="mt-4">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Filters</h3>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Blockchain Networks */}
                  <div className="relative">
                    <Label className="mb-2 block text-sm font-medium">Blockchain Networks</Label>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setOpenDropdowns(prev => ({ ...prev, chains: !prev.chains }))}
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
                    {openDropdowns.chains && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-2">
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
                      </div>
                    )}
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
                  <div className="relative">
                    <Label className="mb-2 block text-sm font-medium">Capabilities</Label>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setOpenDropdowns(prev => ({ ...prev, capabilities: !prev.capabilities }))}
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
                    {openDropdowns.capabilities && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-2">
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
                      </div>
                    )}
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
                  <div className="relative">
                    <Label className="mb-2 block text-sm font-medium">Trust Models</Label>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setOpenDropdowns(prev => ({ ...prev, tags: !prev.tags }))}
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
                    {openDropdowns.tags && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-2">
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
                      </div>
                    )}
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
                  <div>
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4">
            <Card className="border-destructive">
              <CardContent className="p-4">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="overflow-x-auto">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Agent</TableHead>
                    <TableHead className="w-[12%]">ID</TableHead>
                    <TableHead className="w-[13%]">Chain</TableHead>
                    <TableHead className="w-[10%]">Score</TableHead>
                    <TableHead className="w-[20%]">Capabilities</TableHead>
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => {
                      const capabilities = result.metadata?.capabilities;
                      const capabilitiesArray = Array.isArray(capabilities) ? (capabilities as string[]) : [];
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
                          // Save current state before navigating
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
                          <TableCell className="w-[40%]">
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
                                          // Fallback to initial if image fails
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
                                <div className="font-semibold text-sm text-foreground mb-0.5 truncate">
                                  {result.name || `Agent ${formatAgentId(result.agentId)}`}
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
                          <TableCell className="w-[12%]">
                            <Badge variant="outline" className="font-mono text-xs">
                              {getChainName(result.chainId).split(' ')[0]}
                            </Badge>
                          </TableCell>
                          <TableCell className="w-[10%]">
                            <span className="text-xs font-medium">{(result.score * 100).toFixed(0)}%</span>
                          </TableCell>
                          <TableCell className="w-[20%]">
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && query && !error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No results found. Try adjusting your search or filters.</p>
          </div>
        )}

        {/* Initial State */}
        {!loading && results.length === 0 && !query && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Enter a search query above to find agents using semantic search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
