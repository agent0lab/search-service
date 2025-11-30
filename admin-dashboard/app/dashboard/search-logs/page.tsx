'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RequestLog } from '@/lib/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SearchLogsPage() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    statusCode: 'all',
    query: '',
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });

      if (filters.statusCode && filters.statusCode !== 'all') {
        params.append('statusCode', filters.statusCode);
      }
      if (filters.query) {
        params.append('query', filters.query);
      }

      const res = await fetch(`/api/admin/logs/search?${params}`);
      if (res.ok) {
        const data = await res.json() as { logs: RequestLog[]; total: number };
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Search Logs</h2>
        <p className="text-muted-foreground">View and filter search request logs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Search query..."
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              className="max-w-sm"
            />
            <Select
              value={filters.statusCode}
              onValueChange={(v) => setFilters({ ...filters, statusCode: v })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status Code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status Codes</SelectItem>
                <SelectItem value="200">200 - Success</SelectItem>
                <SelectItem value="400">400 - Bad Request</SelectItem>
                <SelectItem value="429">429 - Rate Limited</SelectItem>
                <SelectItem value="500">500 - Server Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs ({total.toLocaleString()})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Query</TableHead>
                      <TableHead>TopK</TableHead>
                      <TableHead>Results</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.ip_address}</TableCell>
                        <TableCell className="max-w-md truncate">{log.query}</TableCell>
                        <TableCell>{log.top_k || '-'}</TableCell>
                        <TableCell>{log.response_count}</TableCell>
                        <TableCell>{log.duration_ms ? `${log.duration_ms}ms` : '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.status_code === 200
                                ? 'default'
                                : log.status_code >= 500
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {log.status_code}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

