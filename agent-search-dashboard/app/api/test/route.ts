import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDBAsync } from '@/lib/get-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDBAsync();
    
    // Try to query the database to see if it's working
    let dbTest = 'unknown';
    let whitelistCount = 0;
    try {
      const whitelist = await db.getWhitelist();
      whitelistCount = whitelist.length;
      dbTest = `Working - found ${whitelist.length} whitelist entries`;
    } catch (error) {
      dbTest = `Error querying DB: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    // Check if getCloudflareContext is available
    let hasCloudflareContext = false;
    let hasContextDB = false;
    let contextError: string | null = null;
    try {
      const context = await getCloudflareContext({ async: true });
      hasCloudflareContext = !!context;
      hasContextDB = !!context?.env?.DB;
    } catch (error) {
      hasCloudflareContext = false;
      contextError = error instanceof Error ? error.message : String(error);
    }
    
    return NextResponse.json({ 
      message: 'Test route works',
      database: 'D1',
      dbTest,
      whitelistCount,
      hasCloudflareContext,
      hasContextDB,
      contextError,
      hasProcessEnvDB: !!(process.env as Record<string, unknown>).DB,
    });
  } catch (error) {
    return NextResponse.json({ 
      message: 'Test route error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ received: body });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

