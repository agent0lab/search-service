import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { address?: string };
    const { address } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
    }

    // Get environment from process.env
    const domain = process.env.SIWE_DOMAIN || request.headers.get('host') || 'localhost:3000';
    
    // URI should be the origin (protocol + domain), not including path
    // For localhost, use http://, for production use https://
    const isLocalhost = domain.includes('localhost') || domain.includes('127.0.0.1');
    const protocol = isLocalhost ? 'http' : 'https';
    const uri = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${domain}`;
    
    // Generate nonce (cryptographically secure random string)
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Generate SIWE message according to EIP-4361 standard
    // The Statement field makes wallets recognize this as a "Sign in" request
    const statement = 'Sign in to the Agent Search Dashboard admin section';
    const issuedAt = new Date().toISOString();
    const message = `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: ${uri}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${issuedAt}`;

    // Store nonce in response (client will need to send it back with signature)
    // In production, you might want to store nonces server-side with expiration
    return NextResponse.json({ message, nonce });
  } catch (error) {
    console.error('SIWE challenge error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate challenge', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    );
  }
}

