import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/get-db';

export async function GET(request: NextRequest) {
  try {
    // Get time range from query params
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('range') as '24h' | '7d' | '30d') || '24h';

    const db = getDB();
    const requestStats = await db.getRequestStats(timeRange);
    const indexingStats = await db.getIndexingStats();
    const indexingLogs = await db.getIndexingLogs(1000, 0); // Get all for count

    // Format to match DashboardStats interface
    return NextResponse.json({
      totalRequests: requestStats.total,
      avgDuration: requestStats.avgDuration,
      successCount: requestStats.successCount,
      errorCount: requestStats.errorCount,
      totalIndexingRuns: indexingLogs.total,
      totalAgentsIndexed: indexingStats.totalIndexed,
      totalAgentsDeleted: indexingStats.totalDeleted,
      lastSyncTime: indexingStats.lastSync,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

