'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, Network, TrendingUp, Code, Users2, Loader2 } from 'lucide-react';

interface StatsData {
  totalAgents: number;
  activeAgents: number;
  agentsByChain: Record<number, number>;
  recentRegistrations24h: number;
  recentRegistrations7d: number;
  mcpEnabled: number;
  a2aEnabled: number;
}

const CHAIN_NAMES: Record<number, string> = {
  11155111: 'Ethereum Sepolia',
  84532: 'Base Sepolia',
  80002: 'Polygon Amoy',
};

export function StatsDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const data = await response.json() as StatsData;
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalChains = Object.keys(stats.agentsByChain).length;
  const chainBreakdown = Object.entries(stats.agentsByChain)
    .map(([chainId, count]) => ({
      chainId: parseInt(chainId, 10),
      name: CHAIN_NAMES[parseInt(chainId, 10)] || `Chain ${chainId}`,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mb-8 space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAgents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {totalChains} network{totalChains !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAgents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalAgents > 0
                ? `${Math.round((stats.activeAgents / stats.totalAgents) * 100)}% of total`
                : '0% of total'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent (24h)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentRegistrations24h.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.recentRegistrations7d} in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protocol Support</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xl font-bold">{stats.mcpEnabled.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Code className="h-3 w-3" />
                  MCP
                </div>
              </div>
              <div>
                <div className="text-xl font-bold">{stats.a2aEnabled.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Users2 className="h-3 w-3" />
                  A2A
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chain Breakdown */}
      {chainBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Agents by Network</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {chainBreakdown.map((chain) => (
                <Badge key={chain.chainId} variant="outline" className="text-sm py-1 px-3">
                  {chain.name}: {chain.count.toLocaleString()}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

