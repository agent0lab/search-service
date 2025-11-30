import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { getDB } from '@/lib/get-db';

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.SIWE_SECRET;
    
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const token = request.cookies.get('admin-session')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const verification = await verifySessionToken(token, secret);

    if (!verification.valid || !verification.session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Verify address is still whitelisted
    const db = getDB();
    const isWhitelisted = await db.isWhitelisted(verification.session.address);

    if (!isWhitelisted) {
      return NextResponse.json({ authenticated: false }, { status: 403 });
    }

    return NextResponse.json({
      authenticated: true,
      address: verification.session.address,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

