'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WalletButton } from '@/components/wallet/WalletButton';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ChevronDown, ChevronUp, Loader2, ExternalLink } from 'lucide-react';

// RPC URLs for SDK initialization
const RPC_URLS: Record<number, string> = {
  11155111: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Ethereum Sepolia
  84532: 'https://sepolia.base.org', // Base Sepolia
  80002: 'https://rpc-amoy.polygon.technology', // Polygon Amoy
};

const CHAIN_OPTIONS = [
  { chainId: 11155111, name: 'Ethereum Sepolia' },
  { chainId: 84532, name: 'Base Sepolia' },
  { chainId: 80002, name: 'Polygon Amoy' },
];

const EXPLORER_BASE_URLS: Record<number, string> = {
  11155111: 'https://sepolia.etherscan.io',
  84532: 'https://sepolia.basescan.org',
  80002: 'https://amoy.polygonscan.com',
};

interface FormData {
  name: string;
  description: string;
  image: string;
  mcpEndpoint: string;
  mcpVersion: string;
  a2aEndpoint: string;
  a2aVersion: string;
  reputation: boolean;
  cryptoEconomic: boolean;
  teeAttestation: boolean;
  x402Support: boolean;
  chainId: number;
  ipfsUri: string;
  ensName: string;
  ensVersion: string;
  oasfSkills: string[];
  oasfDomains: string[];
  metadata: Record<string, string>;
}

export default function CreateAgentPage() {
  const router = useRouter();
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    image: '',
    mcpEndpoint: '',
    mcpVersion: '2025-06-18',
    a2aEndpoint: '',
    a2aVersion: '0.30',
    reputation: false,
    cryptoEconomic: false,
    teeAttestation: false,
    x402Support: false,
    chainId: 11155111, // Default to Ethereum Sepolia
    ipfsUri: '',
    ensName: '',
    ensVersion: '1.0',
    oasfSkills: [],
    oasfDomains: [],
    metadata: {},
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ agentId: string; txHash: string } | null>(null);
  const [switchingChain, setSwitchingChain] = useState(false);

  // Auto-switch chain when form chainId changes
  useEffect(() => {
    if (!isConnected || !address) return;
    if (chainId === formData.chainId) return; // Already on correct chain
    if (switchingChain || isSwitchingChain) return; // Already switching
    if (!switchChain) return; // Switch not available

    // Check if the selected chain is supported
    const selectedChain = CHAIN_OPTIONS.find(c => c.chainId === formData.chainId);
    if (!selectedChain) return;

    // Automatically switch to the selected chain
    const switchToChain = async () => {
      setSwitchingChain(true);
      try {
        await switchChain({ chainId: formData.chainId });
      } catch (err) {
        console.error('Failed to switch chain:', err);
        // Don't set error here - user can manually switch via wallet
      } finally {
        setSwitchingChain(false);
      }
    };

    switchToChain();
  }, [formData.chainId, chainId, isConnected, address, switchChain, switchingChain, isSwitchingChain]);

  const updateFormData = (field: keyof FormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        oasfSkills: [...prev.oasfSkills, skillInput.trim()],
      }));
      setSkillInput('');
    }
  };

  const removeSkill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      oasfSkills: prev.oasfSkills.filter((_, i) => i !== index),
    }));
  };

  const addDomain = () => {
    if (domainInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        oasfDomains: [...prev.oasfDomains, domainInput.trim()],
      }));
      setDomainInput('');
    }
  };

  const removeDomain = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      oasfDomains: prev.oasfDomains.filter((_, i) => i !== index),
    }));
  };

  const addMetadata = () => {
    if (metadataKey.trim() && metadataValue.trim()) {
      setFormData((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, [metadataKey.trim()]: metadataValue.trim() },
      }));
      setMetadataKey('');
      setMetadataValue('');
    }
  };

  const removeMetadata = (key: string) => {
    setFormData((prev) => {
      const newMetadata = { ...prev.metadata };
      delete newMetadata[key];
      return { ...prev, metadata: newMetadata };
    });
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Agent name is required';
    }
    if (!formData.description.trim()) {
      return 'Agent description is required';
    }
    // URI is optional - can be set later with setAgentURI()
    if (formData.ipfsUri.trim() && 
        !formData.ipfsUri.startsWith('ipfs://') && 
        !formData.ipfsUri.startsWith('http://') && 
        !formData.ipfsUri.startsWith('https://')) {
      return 'IPFS/HTTP URI must start with ipfs://, http://, or https://';
    }
    if (!isConnected || !address) {
      return 'Please connect your wallet';
    }
    if (!connector) {
      return 'Wallet connector not available';
    }
    if (!walletClient) {
      return 'Wallet client not ready. Please wait a moment and try again.';
    }
    if (formData.mcpEndpoint && !formData.mcpEndpoint.startsWith('http')) {
      return 'MCP endpoint must be a valid HTTP/HTTPS URL';
    }
    if (formData.a2aEndpoint && !formData.a2aEndpoint.startsWith('http')) {
      return 'A2A endpoint must be a valid HTTP/HTTPS URL';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if wallet is on the correct chain (try to switch if not)
    if (chainId !== formData.chainId) {
      try {
        setLoading(true);
        await switchChain({ chainId: formData.chainId });
        // Wait a moment for the chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        setError(`Please switch to ${CHAIN_OPTIONS.find(c => c.chainId === formData.chainId)?.name || 'the selected chain'} in your wallet`);
        setLoading(false);
        return;
      }
    }

    setLoading(true);

    try {
      // Ensure we're in browser context
      if (typeof window === 'undefined') {
        throw new Error('This function must be called from the browser');
      }
      
      // Dynamically import SDK only on client side to avoid Node.js module issues
      // The SDK's IPFS client has a dynamic import('fs') that Turbopack tries to resolve
      // This is an SDK issue - it should handle browser bundlers better
      // Use a separate loader module to help with module resolution
      const { loadSDK } = await import('@/lib/load-sdk');
      const SDK = await loadSDK();
      
      // Get the EIP-1193 provider - try multiple methods
      type EIP1193Provider = {
        request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
      };
      
      let provider: EIP1193Provider | undefined;

      // Method 1: Try to get from connector (most reliable for wagmi)
      if (connector) {
        try {
          // Try getProvider method
          if ('getProvider' in connector && typeof connector.getProvider === 'function') {
            const connectorProvider = await connector.getProvider();
            if (connectorProvider) {
              // Some connectors return the provider directly, others wrap it
              if (typeof connectorProvider.request === 'function') {
                provider = connectorProvider as EIP1193Provider;
              } else if ((connectorProvider as any).provider && typeof (connectorProvider as any).provider.request === 'function') {
                provider = (connectorProvider as any).provider as EIP1193Provider;
              }
            }
          }
          
          // Try getWalletClient and extract provider from it
          if (!provider && 'getWalletClient' in connector && typeof connector.getWalletClient === 'function') {
            try {
              const client = await connector.getWalletClient();
              if (client) {
                const transport = (client as any).transport;
                if (transport?.value && typeof transport.value.request === 'function') {
                  provider = transport.value;
                } else if (transport && typeof transport.request === 'function') {
                  provider = transport;
                }
              }
            } catch (err) {
              // Ignore errors, try next method
            }
          }
        } catch (err) {
          console.warn('Failed to get provider from connector:', err);
        }
      }

      // Method 2: Try to get from walletClient transport
      if (!provider && walletClient) {
        const transport = (walletClient as any).transport;
        // Check different possible structures
        if (transport?.value && typeof transport.value.request === 'function') {
          provider = transport.value;
        } else if (transport?.request && typeof transport.request === 'function') {
          provider = transport;
        } else if (typeof transport === 'object' && 'request' in transport && typeof (transport as any).request === 'function') {
          provider = transport as EIP1193Provider;
        }
      }

      // Method 3: Fallback to window.ethereum
      if (!provider && typeof window !== 'undefined' && (window as { ethereum?: unknown }).ethereum) {
        const ethereum = (window as { ethereum?: { request?: unknown } }).ethereum;
        if (ethereum && typeof ethereum.request === 'function') {
          provider = ethereum as EIP1193Provider;
        }
      }
      
      if (!provider || typeof provider.request !== 'function') {
        console.error('Provider extraction failed:', {
          hasWalletClient: !!walletClient,
          walletClientType: walletClient ? typeof walletClient : null,
          walletClientKeys: walletClient ? Object.keys(walletClient) : [],
          hasConnector: !!connector,
          connectorType: connector?.type,
          connectorName: connector?.name,
          windowEthereum: typeof window !== 'undefined' ? !!(window as { ethereum?: unknown }).ethereum : false,
        });
        throw new Error('Unable to access wallet provider. Please reconnect your wallet.');
      }

      // Verify the provider works by testing it
      try {
        const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
        console.log('Provider test successful, accounts:', accounts);
      } catch (err) {
        console.warn('Provider test failed, but continuing:', err);
      }

      // Initialize SDK
      const rpcUrl = RPC_URLS[formData.chainId];
      if (!rpcUrl) {
        throw new Error(`Unsupported chain: ${formData.chainId}`);
      }

      // Debug: Log provider info
      console.log('Initializing SDK with:', {
        chainId: formData.chainId,
        rpcUrl,
        hasProvider: !!provider,
        providerType: typeof provider,
        providerKeys: provider ? Object.keys(provider) : [],
        providerRequestType: provider ? typeof provider.request : 'N/A',
      });

      // Double-check provider is valid before passing to SDK
      if (!provider || typeof provider.request !== 'function') {
        throw new Error('Invalid provider: provider.request is not a function');
      }

      // Ensure provider is not undefined/null - create a clean object reference
      const walletProvider: EIP1193Provider = {
        request: provider.request.bind(provider),
      };

      const sdkConfig = {
        chainId: formData.chainId as 11155111 | 84532 | 80002,
        rpcUrl,
        walletProvider,
      };

      console.log('SDK config:', {
        chainId: sdkConfig.chainId,
        rpcUrl: sdkConfig.rpcUrl,
        hasWalletProvider: !!sdkConfig.walletProvider,
        walletProviderType: typeof sdkConfig.walletProvider,
        walletProviderRequestType: typeof sdkConfig.walletProvider?.request,
      });

      const sdk = new SDK(sdkConfig);

      // Debug: Check if SDK recognizes the provider
      console.log('SDK initialized:', {
        isReadOnly: sdk.isReadOnly,
        hasWalletProvider: !!walletProvider,
      });

      if (sdk.isReadOnly) {
        throw new Error('SDK is in read-only mode. Provider was not recognized. Please check your wallet connection.');
      }

      // Create agent
      const agent = sdk.createAgent(
        formData.name.trim(),
        formData.description.trim(),
        formData.image.trim() || undefined
      );

      // Configure endpoints
      if (formData.mcpEndpoint.trim()) {
        await agent.setMCP(formData.mcpEndpoint.trim(), formData.mcpVersion || undefined);
      }
      if (formData.a2aEndpoint.trim()) {
        await agent.setA2A(formData.a2aEndpoint.trim(), formData.a2aVersion || undefined);
      }

      // Set ENS if provided
      if (formData.ensName.trim()) {
        agent.setENS(formData.ensName.trim(), formData.ensVersion || '1.0');
      }

      // Add OASF skills
      for (const skill of formData.oasfSkills) {
        if (skill.trim()) {
          agent.addSkill(skill.trim(), false); // validateOASF=false for now
        }
      }

      // Add OASF domains
      for (const domain of formData.oasfDomains) {
        if (domain.trim()) {
          agent.addDomain(domain.trim(), false); // validateOASF=false for now
        }
      }

      // Set trust models
      agent.setTrust(
        formData.reputation,
        formData.cryptoEconomic,
        formData.teeAttestation
      );

      // Set x402 support
      agent.setX402Support(formData.x402Support);

      // Set active
      agent.setActive(true);

      // Add metadata if any
      if (Object.keys(formData.metadata).length > 0) {
        agent.setMetadata(formData.metadata);
      }

      // Register on-chain with HTTP URI (empty string if not provided - can be set later)
      const registrationFile = await agent.registerHTTP(formData.ipfsUri.trim() || '');
      

      // Get transaction hash from the agent (if available)
      // The SDK might store this, but we'll need to check how to access it
      // For now, we'll just show the agent ID
      const agentId = registrationFile.agentId;
      if (!agentId) {
        throw new Error('Registration completed but agent ID not returned');
      }
      
      setSuccess({
        agentId,
        txHash: '', // Will need to be populated if SDK exposes it
      });

      // Redirect to agent detail page after a short delay
      setTimeout(() => {
        router.push(`/agents/${encodeURIComponent(agentId)}`);
      }, 3000);
    } catch (err) {
      console.error('Error creating agent:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to create agent. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Create Agent</CardTitle>
            <CardDescription>
              Register a new ERC-8004 agent on-chain. Connect your wallet to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <p className="text-muted-foreground">Please connect your wallet to continue</p>
                <WalletButton />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Wallet Connection Status */}
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Connected Wallet</p>
                      <p className="text-sm text-muted-foreground font-mono">{address}</p>
                    </div>
                    <WalletButton />
                  </div>
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Agent Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateFormData('name', e.target.value)}
                      placeholder="My AI Agent"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Description <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => updateFormData('description', e.target.value)}
                      placeholder="A detailed description of what your agent does..."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image">Image URL (optional)</Label>
                    <Input
                      id="image"
                      type="url"
                      value={formData.image}
                      onChange={(e) => updateFormData('image', e.target.value)}
                      placeholder="https://example.com/agent-image.png"
                    />
                  </div>
                </div>

                {/* Endpoints */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Endpoints</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mcpEndpoint">MCP Endpoint (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="mcpEndpoint"
                        type="url"
                        value={formData.mcpEndpoint}
                        onChange={(e) => updateFormData('mcpEndpoint', e.target.value)}
                        placeholder="https://mcp.example.com/"
                        className="flex-1"
                      />
                      <Input
                        value={formData.mcpVersion}
                        onChange={(e) => updateFormData('mcpVersion', e.target.value)}
                        placeholder="2025-06-18"
                        className="w-32"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="a2aEndpoint">A2A Endpoint (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="a2aEndpoint"
                        type="url"
                        value={formData.a2aEndpoint}
                        onChange={(e) => updateFormData('a2aEndpoint', e.target.value)}
                        placeholder="https://a2a.example.com/agent-card.json"
                        className="flex-1"
                      />
                      <Input
                        value={formData.a2aVersion}
                        onChange={(e) => updateFormData('a2aVersion', e.target.value)}
                        placeholder="0.30"
                        className="w-32"
                      />
                    </div>
                  </div>
                </div>

                {/* Trust Models */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Trust Models</h3>
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="reputation"
                        checked={formData.reputation}
                        onCheckedChange={(checked) => updateFormData('reputation', checked === true)}
                      />
                      <Label htmlFor="reputation" className="font-normal cursor-pointer">
                        Reputation
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="cryptoEconomic"
                        checked={formData.cryptoEconomic}
                        onCheckedChange={(checked) => updateFormData('cryptoEconomic', checked === true)}
                      />
                      <Label htmlFor="cryptoEconomic" className="font-normal cursor-pointer">
                        Crypto-Economic
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="teeAttestation"
                        checked={formData.teeAttestation}
                        onCheckedChange={(checked) => updateFormData('teeAttestation', checked === true)}
                      />
                      <Label htmlFor="teeAttestation" className="font-normal cursor-pointer">
                        TEE Attestation
                      </Label>
                    </div>
                  </div>
                </div>

                {/* x402 Support */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="x402Support"
                      checked={formData.x402Support}
                      onCheckedChange={(checked) => updateFormData('x402Support', checked === true)}
                    />
                    <Label htmlFor="x402Support" className="font-normal cursor-pointer">
                      x402 Payment Support
                    </Label>
                  </div>
                </div>

                {/* Chain Selection */}
                <div className="space-y-2">
                  <Label htmlFor="chainId">
                    Blockchain Network <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.chainId.toString()}
                    onValueChange={(value) => updateFormData('chainId', parseInt(value, 10))}
                  >
                    <SelectTrigger id="chainId">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHAIN_OPTIONS.map((chain) => (
                        <SelectItem key={chain.chainId} value={chain.chainId.toString()}>
                          {chain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {chainId !== formData.chainId && (isSwitchingChain || switchingChain) && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Switching to {CHAIN_OPTIONS.find(c => c.chainId === formData.chainId)?.name || 'selected network'}...
                    </p>
                  )}
                  {chainId !== formData.chainId && !isSwitchingChain && !switchingChain && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Switching to {CHAIN_OPTIONS.find(c => c.chainId === formData.chainId)?.name || 'selected network'}...
                    </p>
                  )}
                </div>

                {/* IPFS/HTTP URI */}
                <div className="space-y-2">
                  <Label htmlFor="ipfsUri">IPFS/HTTP URI (optional)</Label>
                  <Input
                    id="ipfsUri"
                    value={formData.ipfsUri}
                    onChange={(e) => updateFormData('ipfsUri', e.target.value)}
                    placeholder="ipfs://Qm... or https://example.com/agent.json"
                  />
                  <p className="text-sm text-muted-foreground">
                    Paste the IPFS URI or HTTP URL where your agent registration file is hosted. You can set this later if you don't have it yet.
                  </p>
                </div>

                {/* Advanced Section */}
                <div className="space-y-4 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Advanced Options
                  </button>

                  {showAdvanced && (
                    <div className="space-y-6 pl-6 border-l">
                      {/* ENS */}
                      <div className="space-y-2">
                        <Label htmlFor="ensName">ENS Name (optional)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="ensName"
                            value={formData.ensName}
                            onChange={(e) => updateFormData('ensName', e.target.value)}
                            placeholder="myagent.eth"
                            className="flex-1"
                          />
                          <Input
                            value={formData.ensVersion}
                            onChange={(e) => updateFormData('ensVersion', e.target.value)}
                            placeholder="1.0"
                            className="w-24"
                          />
                        </div>
                      </div>

                      {/* OASF Skills */}
                      <div className="space-y-2">
                        <Label>OASF Skills (optional)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={skillInput}
                            onChange={(e) => setSkillInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addSkill();
                              }
                            }}
                            placeholder="natural_language_processing/summarization"
                            className="flex-1"
                          />
                          <Button type="button" onClick={addSkill} variant="outline">
                            Add
                          </Button>
                        </div>
                        {formData.oasfSkills.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.oasfSkills.map((skill, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm"
                              >
                                <span>{skill}</span>
                                <button
                                  type="button"
                                  onClick={() => removeSkill(index)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* OASF Domains */}
                      <div className="space-y-2">
                        <Label>OASF Domains (optional)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addDomain();
                              }
                            }}
                            placeholder="finance_and_business/investment_services"
                            className="flex-1"
                          />
                          <Button type="button" onClick={addDomain} variant="outline">
                            Add
                          </Button>
                        </div>
                        {formData.oasfDomains.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.oasfDomains.map((domain, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm"
                              >
                                <span>{domain}</span>
                                <button
                                  type="button"
                                  onClick={() => removeDomain(index)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="space-y-2">
                        <Label>Additional Metadata (optional)</Label>
                        <div className="flex gap-2">
                          <Input
                            value={metadataKey}
                            onChange={(e) => setMetadataKey(e.target.value)}
                            placeholder="Key"
                            className="flex-1"
                          />
                          <Input
                            value={metadataValue}
                            onChange={(e) => setMetadataValue(e.target.value)}
                            placeholder="Value"
                            className="flex-1"
                          />
                          <Button type="button" onClick={addMetadata} variant="outline">
                            Add
                          </Button>
                        </div>
                        {Object.keys(formData.metadata).length > 0 && (
                          <div className="space-y-1 mt-2">
                            {Object.entries(formData.metadata).map(([key, value]) => (
                              <div
                                key={key}
                                className="flex items-center justify-between px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm"
                              >
                                <span>
                                  <span className="font-mono">{key}</span>: {value}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeMetadata(key)}
                                  className="text-muted-foreground hover:text-foreground ml-2"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                    {error}
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400">
                    <p className="font-semibold mb-2">Agent created successfully!</p>
                    <p className="text-sm mb-2">Agent ID: <span className="font-mono">{success.agentId}</span></p>
                    {success.txHash && (
                      <a
                        href={`${EXPLORER_BASE_URLS[formData.chainId]}/tx/${success.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm flex items-center gap-1 underline"
                      >
                        View transaction <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <p className="text-sm mt-2">Redirecting to agent page...</p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading || !isConnected || chainId !== formData.chainId}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Agent...
                    </>
                  ) : (
                    'Create Agent'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
