import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { getDBAsync } from '@/lib/get-db';

async function getAuthenticatedAddress(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('admin-session')?.value;
  if (!token) return null;

  const secret = process.env.SIWE_SECRET;
  if (!secret) return null;

  const verification = await verifySessionToken(token, secret);
  if (!verification.valid || !verification.session) return null;

  return verification.session.address;
}

export async function GET(request: NextRequest) {
  try {
    const address = await getAuthenticatedAddress(request);
    if (!address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDBAsync();
    const whitelist = await db.getWhitelist();

    return NextResponse.json({ whitelist });
  } catch (error) {
    console.error('Whitelist GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch whitelist' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const address = await getAuthenticatedAddress(request);
    if (!address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { walletAddress?: string };
    const { walletAddress } = body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // Basic address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format' }, { status: 400 });
    }

    const db = await getDBAsync();
    await db.addToWhitelist(walletAddress, address);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Whitelist POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add to whitelist' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const address = await getAuthenticatedAddress(request);
    if (!address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    const db = await getDBAsync();
    await db.removeFromWhitelist(walletAddress);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Whitelist DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove from whitelist' },
      { status: 500 }
    );
  }
}

