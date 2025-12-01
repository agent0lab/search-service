import { NextRequest, NextResponse } from 'next/server';
import { getDBAsync } from '@/lib/get-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const syncLogId = parseInt(id, 10);

    if (Number.isNaN(syncLogId)) {
      return NextResponse.json(
        { error: 'Invalid sync log ID' },
        { status: 400 }
      );
    }

    const db = await getDBAsync();
    const events = await db.getSyncLogEvents(syncLogId);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Sync log events API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync log events' },
      { status: 500 }
    );
  }
}

