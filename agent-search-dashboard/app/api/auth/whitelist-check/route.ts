import { NextRequest, NextResponse } from 'next/server';
import { getDBAsync } from '@/lib/get-db';

/**
 * Public endpoint to check if a wallet address is whitelisted
 * Used by the Header to determine if Admin button should be shown
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Address parameter required' }, { status: 400 });
    }

    // Basic address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format' }, { status: 400 });
    }

    const db = await getDBAsync();
    const isWhitelisted = await db.isWhitelisted(address);

    return NextResponse.json({ whitelisted: isWhitelisted });
  } catch (error) {
    console.error('Whitelist check error:', error);
    return NextResponse.json(
      { error: 'Failed to check whitelist' },
      { status: 500 }
    );
  }
}
