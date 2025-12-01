// Mock database for development - will be replaced with real D1 later
import type { RequestLogEntry, IndexingLogEntry, WhitelistEntry } from './types';

// Mock data storage
const mockRequestLogs: RequestLogEntry[] = [];
const mockIndexingLogs: IndexingLogEntry[] = [];
const mockWhitelist: WhitelistEntry[] = [
  {
    id: 1,
    wallet_address: '0x55c7e5124fc14a3cdde1f09ecbb8676141c5a06c',
    added_at: new Date().toISOString(),
    added_by: 'initial',
  },
];

export const mockDB = {
  // Request logs
  getRequestLogs: async (limit: number = 50, offset: number = 0): Promise<{ logs: RequestLogEntry[]; total: number }> => {
    return {
      logs: mockRequestLogs.slice(offset, offset + limit),
      total: mockRequestLogs.length,
    };
  },

  getRequestStats: async (timeRange: '24h' | '7d' | '30d' = '24h'): Promise<{
    total: number;
    avgDuration: number;
    successCount: number;
    errorCount: number;
  }> => {
    const now = Date.now();
    const ranges = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - ranges[timeRange];

    const filtered = mockRequestLogs.filter(
      (log) => new Date(log.timestamp).getTime() >= cutoff
    );

    const durations = filtered.map((log) => log.durationMs).filter((d) => d > 0);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      total: filtered.length,
      avgDuration: Math.round(avgDuration),
      successCount: filtered.filter((log) => log.statusCode === 200).length,
      errorCount: filtered.filter((log) => log.statusCode !== 200).length,
    };
  },

  // Indexing logs
  getIndexingLogs: async (limit: number = 50, offset: number = 0): Promise<{ logs: IndexingLogEntry[]; total: number }> => {
    return {
      logs: mockIndexingLogs.slice(offset, offset + limit),
      total: mockIndexingLogs.length,
    };
  },

  getIndexingStats: async (): Promise<{
    totalIndexed: number;
    totalDeleted: number;
    lastSync: string | null;
  }> => {
    const lastLog = mockIndexingLogs[0];
    const totalIndexed = mockIndexingLogs.reduce((sum, log) => sum + log.agents_indexed, 0);
    const totalDeleted = mockIndexingLogs.reduce((sum, log) => sum + log.agents_deleted, 0);

    return {
      totalIndexed,
      totalDeleted,
      lastSync: lastLog?.started_at || null,
    };
  },

  // Whitelist
  getWhitelist: async (): Promise<WhitelistEntry[]> => {
    return [...mockWhitelist];
  },

  isWhitelisted: async (address: string): Promise<boolean> => {
    const normalized = address.toLowerCase();
    return mockWhitelist.some((entry) => entry.wallet_address.toLowerCase() === normalized);
  },

  addToWhitelist: async (address: string, addedBy?: string): Promise<void> => {
    const normalized = address.toLowerCase();
    if (!mockWhitelist.some((entry) => entry.wallet_address.toLowerCase() === normalized)) {
      mockWhitelist.push({
        id: mockWhitelist.length + 1,
        wallet_address: normalized,
        added_at: new Date().toISOString(),
        added_by: addedBy || 'admin',
      });
    }
  },

  removeFromWhitelist: async (address: string): Promise<void> => {
    const normalized = address.toLowerCase();
    const index = mockWhitelist.findIndex((entry) => entry.wallet_address.toLowerCase() === normalized);
    if (index !== -1) {
      mockWhitelist.splice(index, 1);
    }
  },
};

