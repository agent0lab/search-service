import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('SIWE verify: Starting verification');
    
    const { verifySiweMessage } = await import('@/lib/siwe');
    console.log('SIWE verify: Imported verifySiweMessage');
    
    const { createSessionToken, getSessionCookieName, getSessionCookieOptions } = await import('@/lib/auth');
    console.log('SIWE verify: Imported auth utilities');
    
    const { getDBAsync } = await import('@/lib/get-db');
    console.log('SIWE verify: Imported getDBAsync');

    const secret = process.env.SIWE_SECRET;
    if (!secret) {
      console.error('SIWE verify: SIWE_SECRET not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json() as { message?: string; signature?: string };
    const { message, signature } = body;
    console.log('SIWE verify: Received message and signature');

    if (!message || !signature) {
      return NextResponse.json({ error: 'Missing message or signature' }, { status: 400 });
    }

    const domain = process.env.SIWE_DOMAIN || request.headers.get('host') || 'localhost:3000';
    console.log('SIWE verify: Domain:', domain);
    
    // First verify message format and domain
    console.log('SIWE verify: Verifying message format');
    const formatVerification = await verifySiweMessage(message, signature, domain);
    console.log('SIWE verify: Format verification result:', formatVerification);
    
    if (!formatVerification.success || !formatVerification.address) {
      return NextResponse.json({ error: formatVerification.error || 'Invalid message format' }, { status: 401 });
    }

    // Then verify signature using viem (dynamic import to avoid bundling issues)
    console.log('SIWE verify: Verifying signature with viem');
    let recoveredAddress: string;
    try {
      const viem = await import('viem');
      console.log('SIWE verify: Imported viem');
      recoveredAddress = await viem.recoverMessageAddress({
        message: message as `0x${string}` | string,
        signature: signature as `0x${string}`,
      });
      console.log('SIWE verify: Recovered address:', recoveredAddress);
    } catch (error) {
      console.error('SIWE verify: Viem import/verification error:', error);
      const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error;
      console.error('SIWE verify: Error details:', errorDetails);
      return NextResponse.json({ error: 'Signature verification failed', details: process.env.NODE_ENV === 'development' ? String(error) : undefined }, { status: 401 });
    }

    // Normalize addresses for comparison
    const normalizedRecovered = recoveredAddress.toLowerCase();
    const normalizedExtracted = formatVerification.address!.toLowerCase();
    console.log('SIWE verify: Comparing addresses - recovered:', normalizedRecovered, 'extracted:', normalizedExtracted);

    if (normalizedRecovered !== normalizedExtracted) {
      return NextResponse.json({ error: 'Address mismatch' }, { status: 401 });
    }

    const verification = {
      success: true,
      address: normalizedRecovered,
    };

    // Check whitelist
    console.log('SIWE verify: Checking whitelist for:', verification.address);
    const db = await getDBAsync();
    const isWhitelisted = await db.isWhitelisted(verification.address!);
    console.log('SIWE verify: Whitelist check result:', isWhitelisted);

    if (!isWhitelisted) {
      return NextResponse.json({ error: 'Address not whitelisted' }, { status: 403 });
    }

    // Create session token
    console.log('SIWE verify: Creating session token');
    const token = await createSessionToken(verification.address!, secret);
    console.log('SIWE verify: Session token created');

    // Set httpOnly cookie
    const response = NextResponse.json({ success: true, address: verification.address! });
    response.cookies.set(getSessionCookieName(), token, getSessionCookieOptions(domain !== 'localhost:3000'));
    console.log('SIWE verify: Success - returning response');

    return response;
  } catch (error) {
    console.error('SIWE verify: Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('SIWE verify: Full error details:', { errorMessage, errorStack, error });
    return NextResponse.json(
      { 
        error: 'Failed to verify signature', 
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

