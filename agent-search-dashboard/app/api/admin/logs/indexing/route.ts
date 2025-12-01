import { NextRequest, NextResponse } from 'next/server';
import { getDBAsync } from '@/lib/get-db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const db = await getDBAsync();
    const result = await db.getIndexingLogs(limit, offset);

    return NextResponse.json({ ...result, limit, offset });
  } catch (error) {
    console.error('Indexing logs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch indexing logs' },
      { status: 500 }
    );
  }
}

