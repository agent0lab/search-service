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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IndexingLog } from '@/lib/types';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { SyncLogEventEntry } from '@/lib/types';

export default function IndexingLogsPage() {
  const [logs, setLogs] = useState<IndexingLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [events, setEvents] = useState<Record<number, SyncLogEventEntry[]>>({});
  const [loadingEvents, setLoadingEvents] = useState<Record<number, boolean>>({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const res = await fetch(`/api/admin/logs/indexing?${params}`);
      if (res.ok) {
        const data = await res.json() as { logs: IndexingLog[]; total: number };
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const fetchEvents = useCallback(async (logId: number) => {
    if (events[logId]) return; // Already loaded
    
    setLoadingEvents((prev) => ({ ...prev, [logId]: true }));
    try {
      const res = await fetch(`/api/admin/logs/indexing/${logId}/events`);
      if (res.ok) {
        const data = await res.json() as { events: SyncLogEventEntry[] };
        setEvents((prev) => ({ ...prev, [logId]: data.events }));
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoadingEvents((prev) => ({ ...prev, [logId]: false }));
    }
  }, [events]);

  const toggleExpand = (logId: number) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(logId);
      fetchEvents(logId);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Indexing Logs</h2>
        <p className="text-muted-foreground">View indexing sync logs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
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
                      <TableHead>Started At</TableHead>
                      <TableHead>Completed At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Chains</TableHead>
                      <TableHead>Indexed</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead>Batches</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const chains = JSON.parse(log.chains) as number[];
                      const isExpanded = expandedLogId === log.id;
                      const logEvents = events[log.id] || [];
                      const isLoadingEvents = loadingEvents[log.id];
                      
                      return (
                        <>
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs">
                              {new Date(log.started_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.completed_at ? new Date(log.completed_at).toLocaleString() : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  log.status === 'success'
                                    ? 'default'
                                    : log.status === 'error'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{chains.join(', ')}</TableCell>
                            <TableCell>{log.agents_indexed}</TableCell>
                            <TableCell>{log.agents_deleted}</TableCell>
                            <TableCell>{log.batches_processed}</TableCell>
                            <TableCell>
                              {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(log.id)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/50">
                                {isLoadingEvents ? (
                                  <div className="p-4 text-center">Loading events...</div>
                                ) : logEvents.length === 0 ? (
                                  <div className="p-4 text-center text-muted-foreground">
                                    No detailed events found
                                  </div>
                                ) : (
                                  <div className="p-4 space-y-4">
                                    <h4 className="font-semibold">Batch Events ({logEvents.length})</h4>
                                    <div className="space-y-2">
                                      {logEvents.map((event) => (
                                        <Card key={event.id}>
                                          <CardContent className="p-4">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                              <div>
                                                <div className="text-muted-foreground">Chain</div>
                                                <div className="font-mono">{event.chainId}</div>
                                              </div>
                                              <div>
                                                <div className="text-muted-foreground">Type</div>
                                                <Badge variant="outline">{event.eventType}</Badge>
                                              </div>
                                              <div>
                                                <div className="text-muted-foreground">Indexed</div>
                                                <div>{event.agentsIndexed}</div>
                                              </div>
                                              <div>
                                                <div className="text-muted-foreground">Deleted</div>
                                                <div>{event.agentsDeleted}</div>
                                              </div>
                                              <div className="col-span-2">
                                                <div className="text-muted-foreground">Time</div>
                                                <div className="font-mono text-xs">
                                                  {new Date(event.timestamp).toLocaleString()}
                                                </div>
                                              </div>
                                              {event.lastUpdatedAt && (
                                                <div className="col-span-2">
                                                  <div className="text-muted-foreground">Last Updated</div>
                                                  <div className="font-mono text-xs">{event.lastUpdatedAt}</div>
                                                </div>
                                              )}
                                              {event.agentIdsIndexed && event.agentIdsIndexed.length > 0 && (
                                                <div className="col-span-full">
                                                  <div className="text-muted-foreground mb-1">
                                                    Indexed Agent IDs ({event.agentIdsIndexed.length})
                                                  </div>
                                                  <div className="font-mono text-xs bg-background p-2 rounded border max-h-32 overflow-y-auto">
                                                    {event.agentIdsIndexed.join(', ')}
                                                  </div>
                                                </div>
                                              )}
                                              {event.agentIdsDeleted && event.agentIdsDeleted.length > 0 && (
                                                <div className="col-span-full">
                                                  <div className="text-muted-foreground mb-1">
                                                    Deleted Agent IDs ({event.agentIdsDeleted.length})
                                                  </div>
                                                  <div className="font-mono text-xs bg-background p-2 rounded border max-h-32 overflow-y-auto">
                                                    {event.agentIdsDeleted.join(', ')}
                                                  </div>
                                                </div>
                                              )}
                                              {event.errorMessage && (
                                                <div className="col-span-full">
                                                  <div className="text-destructive font-semibold mb-1">Error</div>
                                                  <div className="text-sm text-destructive">{event.errorMessage}</div>
                                                </div>
                                              )}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
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

