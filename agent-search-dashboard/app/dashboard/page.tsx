'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DashboardStats } from '@/lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?range=${timeRange}`);
      if (res.ok) {
        const data = await res.json() as DashboardStats;
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!stats) {
    return <div>Failed to load stats</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Overview</h2>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as '24h' | '7d' | '30d')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <StatsCards stats={stats} timeRange={timeRange} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Indexing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Sync:</span>
                <span className="text-sm font-medium">
                  {stats.lastSyncTime
                    ? new Date(stats.lastSyncTime).toLocaleString()
                    : 'Never'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Syncs:</span>
                <span className="text-sm font-medium">{stats.totalIndexingRuns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Agents Deleted:</span>
                <span className="text-sm font-medium">{stats.totalAgentsDeleted || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Successful:</span>
                <span className="text-sm font-medium text-green-600">
                  {stats.successCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Errors:</span>
                <span className="text-sm font-medium text-red-600">
                  {stats.errorCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Error Rate:</span>
                <span className="text-sm font-medium">
                  {stats.totalRequests > 0
                    ? ((stats.errorCount / stats.totalRequests) * 100).toFixed(2)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

