'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Clock, CheckCircle, XCircle, Database, RefreshCw } from 'lucide-react';
import type { DashboardStats } from '@/lib/types';

interface StatsCardsProps {
  stats: DashboardStats;
  timeRange: '24h' | '7d' | '30d';
}

export function StatsCards({ stats, timeRange }: StatsCardsProps) {
  const rangeLabel = timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Last {rangeLabel}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(stats.avgDuration)}ms</div>
          <p className="text-xs text-muted-foreground">Last {rangeLabel}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.totalRequests > 0
              ? Math.round((stats.successCount / stats.totalRequests) * 100)
              : 0}
            %
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.successCount} / {stats.totalRequests} requests
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Agents Indexed</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalAgentsIndexed?.toLocaleString() || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats.totalIndexingRuns} sync runs
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

