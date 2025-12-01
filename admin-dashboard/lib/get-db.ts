import type { D1Database } from '@cloudflare/workers-types';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { D1Client } from './d1-client';

type RequestLogFilters = {
  startDate?: string;
  endDate?: string;
  statusCode?: number;
  ipAddress?: string;
  query?: string;
};

type IndexingLogFilters = {
  startDate?: string;
  endDate?: string;
  status?: string;
};

// Adapter to match mockDB interface
class D1Adapter {
  constructor(private d1Client: D1Client) {}

  async getRequestLogs(limit: number = 50, offset: number = 0, filters?: RequestLogFilters) {
    const logs = await this.d1Client.getRequestLogs(limit, offset, filters);
    const total = await this.d1Client.getRequestLogsCount(filters);
    return { logs, total };
  }

  async getRequestStats(timeRange: '24h' | '7d' | '30d' = '24h') {
    const stats = await this.d1Client.getDashboardStats(timeRange);
    return {
      total: stats.totalRequests,
      avgDuration: stats.avgDuration,
      successCount: stats.successCount,
      errorCount: stats.errorCount,
    };
  }

  async getIndexingLogs(limit: number = 50, offset: number = 0, filters?: IndexingLogFilters) {
    const logs = await this.d1Client.getIndexingLogs(limit, offset, filters);
    const total = await this.d1Client.getIndexingLogsCount(filters);
    return { logs, total };
  }

      async getIndexingStats() {
        const stats = await this.d1Client.getDashboardStats('30d');
        return {
          totalIndexed: stats.totalAgentsIndexed,
          totalDeleted: stats.totalAgentsDeleted,
          lastSync: stats.lastSyncTime,
        };
      }

      async getSyncLogEvents(syncLogId: number) {
        return this.d1Client.getSyncLogEvents(syncLogId);
      }

  async getWhitelist() {
    return this.d1Client.getWhitelist();
  }

  async isWhitelisted(address: string) {
    return this.d1Client.isWhitelisted(address);
  }

  async addToWhitelist(address: string, addedBy?: string) {
    return this.d1Client.addToWhitelist(address, addedBy || 'admin');
  }

  async removeFromWhitelist(address: string) {
    return this.d1Client.removeFromWhitelist(address);
  }
}

/**
 * Get database client (async version for API routes)
 * Requires D1 database to be available via getCloudflareContext()
 * 
 * @throws Error if D1 database is not available
 */
export async function getDBAsync() {
  console.log('[getDBAsync] Attempting to get D1 database...');
  
  let db: D1Database | undefined;
  let errorDetails: { method: string; error?: string } | null = null;
  
  try {
    // Method 1: Use getCloudflareContext({ async: true }) - the correct way in OpenNext for Cloudflare
    const context = await getCloudflareContext({ async: true });
    console.log('[getDBAsync] getCloudflareContext() called successfully');
    console.log('[getDBAsync] Context details:', {
      hasContext: !!context,
      hasEnv: !!context?.env,
      hasDB: !!context?.env?.DB,
      envKeys: context?.env ? Object.keys(context.env) : [],
    });
    
    if (context?.env?.DB) {
      db = context.env.DB;
      console.log('[getDBAsync] ✅ Found DB through getCloudflareContext().env.DB');
    } else {
      errorDetails = { 
        method: 'getCloudflareContext', 
        error: 'Context exists but env.DB is not available' 
      };
      console.error('[getDBAsync] ❌ Context exists but env.DB is missing');
    }
  } catch (error) {
    errorDetails = { 
      method: 'getCloudflareContext', 
      error: error instanceof Error ? error.message : String(error) 
    };
    console.error('[getDBAsync] ❌ getCloudflareContext() failed:', errorDetails.error);
  }
  
  // Fallback: Try process.env (shouldn't be needed but check anyway)
  if (!db) {
    try {
      db = (process.env as Record<string, unknown>).DB as D1Database | undefined;
      if (db) {
        console.log('[getDBAsync] ✅ Found DB through process.env (fallback)');
      } else {
        console.log('[getDBAsync] process.env.DB is not available');
      }
    } catch (error) {
      console.error('[getDBAsync] Error checking process.env:', error);
    }
  }
  
  if (!db) {
    const errorMessage = `D1 database not available. ${errorDetails ? `Error from ${errorDetails.method}: ${errorDetails.error}` : 'No error details available.'}`;
    console.error('[getDBAsync] ❌', errorMessage);
    throw new Error(`Database unavailable: ${errorMessage}`);
  }
  
  console.log('[getDBAsync] ✅ Successfully initialized D1 database client');
  return new D1Adapter(new D1Client(db));
}

/**
 * Get database client (sync version for non-async contexts)
 * Requires D1 database to be available via getCloudflareContext()
 * 
 * @throws Error if D1 database is not available
 */
export function getDB() {
  console.log('[getDB] Attempting to get D1 database (sync)...');
  
  let db: D1Database | undefined;
  let errorDetails: { method: string; error?: string } | null = null;
  
  try {
    // Use getCloudflareContext() for sync contexts
    const context = getCloudflareContext();
    console.log('[getDB] getCloudflareContext() called successfully');
    console.log('[getDB] Context details:', {
      hasContext: !!context,
      hasEnv: !!context?.env,
      hasDB: !!context?.env?.DB,
      envKeys: context?.env ? Object.keys(context.env) : [],
    });
    
    if (context?.env?.DB) {
      db = context.env.DB;
      console.log('[getDB] ✅ Found DB through getCloudflareContext().env.DB');
    } else {
      errorDetails = { 
        method: 'getCloudflareContext', 
        error: 'Context exists but env.DB is not available' 
      };
      console.error('[getDB] ❌ Context exists but env.DB is missing');
    }
  } catch (error) {
    errorDetails = { 
      method: 'getCloudflareContext', 
      error: error instanceof Error ? error.message : String(error) 
    };
    console.error('[getDB] ❌ getCloudflareContext() failed:', errorDetails.error);
  }
  
  // Fallback: Try process.env (shouldn't be needed but check anyway)
  if (!db) {
    try {
      db = (process.env as Record<string, unknown>).DB as D1Database | undefined;
      if (db) {
        console.log('[getDB] ✅ Found DB through process.env (fallback)');
      } else {
        console.log('[getDB] process.env.DB is not available');
      }
    } catch (error) {
      console.error('[getDB] Error checking process.env:', error);
    }
  }
  
  if (!db) {
    const errorMessage = `D1 database not available. ${errorDetails ? `Error from ${errorDetails.method}: ${errorDetails.error}` : 'No error details available.'}`;
    console.error('[getDB] ❌', errorMessage);
    throw new Error(`Database unavailable: ${errorMessage}`);
  }
  
  console.log('[getDB] ✅ Successfully initialized D1 database client');
  return new D1Adapter(new D1Client(db));
}
