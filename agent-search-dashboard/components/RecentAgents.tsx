'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentAgent {
  agentId: string;
  chainId: number;
  name: string;
  image?: string;
  description: string;
  createdAt: string;
  active: boolean;
}

const CHAIN_NAMES: Record<number, string> = {
  11155111: 'Ethereum Sepolia',
  84532: 'Base Sepolia',
  80002: 'Polygon Amoy',
};

const getChainColor = (chainId: number) => {
  const colors: Record<number, string> = {
    11155111: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    84532: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    80002: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  };
  return colors[chainId] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function AgentCard({ agent, agentUrl, getChainColor }: { agent: RecentAgent; agentUrl: string; getChainColor: (chainId: number) => string }) {
  const [imageError, setImageError] = useState(false);

  return (
    <Link href={agentUrl} className="block h-full">
      <Card className="h-full hover:shadow-lg transition-all duration-200 cursor-pointer group border-2 hover:border-primary/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-3">
            {agent.image && !imageError ? (
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border bg-slate-100 dark:bg-slate-800">
                <img
                  src={agent.image}
                  alt={agent.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border flex items-center justify-center">
                <span className="text-lg font-bold text-primary">
                  {agent.name[0]?.toUpperCase() || 'A'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1 truncate group-hover:text-primary transition-colors">
                {agent.name}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${getChainColor(agent.chainId)}`}>
                  {CHAIN_NAMES[agent.chainId]?.split(' ')[0] || `Chain ${agent.chainId}`}
                </Badge>
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
              </div>
            </div>
          </div>
          {agent.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {agent.description}
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            Registered {formatDate(agent.createdAt)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function RecentAgents() {
  const [agents, setAgents] = useState<RecentAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentAgents = async () => {
      try {
        const response = await fetch('/api/recent-agents?limit=12');
        if (response.ok) {
          const data = await response.json() as { agents: RecentAgent[] };
          setAgents(data.agents || []);
        }
      } catch (error) {
        console.error('Failed to fetch recent agents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentAgents();
  }, []);

  if (loading) {
    return (
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Recent Agents</h2>
        <Link href="/?q=">
          <Button variant="ghost" size="sm">
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => {
          const agentUrl = `/agents/${encodeURIComponent(agent.agentId)}`;
          return (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              agentUrl={agentUrl}
              getChainColor={getChainColor}
            />
          );
        })}
      </div>
    </div>
  );
}
