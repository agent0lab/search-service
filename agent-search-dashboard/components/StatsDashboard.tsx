'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, Network } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsData {
  totalAgents: number;
  activeAgents: number;
  agentsByChain: Record<number, number>;
  recentRegistrations24h: number;
  recentRegistrations7d: number;
  mcpEnabled: number;
  a2aEnabled: number;
  growthRate7d: number;
}

const CHAIN_NAMES: Record<number, string> = {
  11155111: 'Ethereum Sepolia',
  84532: 'Base Sepolia',
  80002: 'Polygon Amoy',
};

interface StatsDashboardProps {
  activeChainId?: number;
}

export function StatsDashboard({ activeChainId }: StatsDashboardProps = {}) {
  const router = useRouter();
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
      <div className="mb-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-32 rounded-full" />
              ))}
            </div>
          </CardContent>
        </Card>
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

  const handleNetworkClick = (chainId: number) => {
    // If clicking the active chain, clear the filter, otherwise set it
    if (activeChainId === chainId) {
      router.push('/');
    } else {
      router.push(`/?chainId=${chainId}`);
    }
  };

  return (
    <div className="mb-8 space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/30 cursor-pointer group bg-slate-900/40 backdrop-blur-md border-slate-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:scale-110" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary/70 transition-all">
              {stats.totalAgents.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/80 transition-colors">
              Across {totalChains} network{totalChains !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/30 cursor-pointer group bg-slate-900/40 backdrop-blur-md border-slate-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">Growth Rate (7d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:scale-110" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary/70 transition-all">
              {stats.growthRate7d.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/80 transition-colors">
              {stats.recentRegistrations7d} new agents this week
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/30 cursor-pointer group bg-slate-900/40 backdrop-blur-md border-slate-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">Recent (24h)</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:scale-110" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary/70 transition-all">
              {stats.recentRegistrations24h.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/80 transition-colors">
              {stats.recentRegistrations7d} in last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chain Breakdown */}
      {chainBreakdown.length > 0 && (
        <Card className="bg-slate-900/40 backdrop-blur-md border-slate-800/40">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Agents by Network</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {chainBreakdown.map((chain) => {
                const isActive = activeChainId === chain.chainId;
                return (
                  <Badge 
                    key={chain.chainId} 
                    variant={isActive ? "default" : "outline"}
                    className={cn(
                      "text-sm py-1 px-3 cursor-pointer transition-colors",
                      isActive 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "hover:bg-primary/10 hover:border-primary/50"
                    )}
                    onClick={() => handleNetworkClick(chain.chainId)}
                  >
                    {chain.name}: {chain.count.toLocaleString()}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

