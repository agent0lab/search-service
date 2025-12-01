import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';
import { getDBAsync } from './lib/get-db';

export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
};

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('admin-session')?.value;

  if (!token) {
    return handleUnauthorized(request);
  }

  const secret = process.env.SIWE_SECRET;
  if (!secret) {
    return handleUnauthorized(request);
  }

  const verification = await verifySessionToken(token, secret);

  if (!verification.valid || !verification.session) {
    const response = handleUnauthorized(request);
    response.cookies.delete('admin-session');
    return response;
  }

  // Verify address is still whitelisted
  try {
    const db = await getDBAsync();
    const isWhitelisted = await db.isWhitelisted(verification.session.address);

    if (!isWhitelisted) {
      const response = handleUnauthorized(request);
      response.cookies.delete('admin-session');
      return response;
    }
  } catch (error) {
    console.error('Middleware whitelist check error:', error);
    return handleUnauthorized(request);
  }

  return NextResponse.next();
}

function handleUnauthorized(request: NextRequest): NextResponse {
  // For API routes, return 401 JSON response
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // For UI routes, redirect to login
  return NextResponse.redirect(new URL('/login', request.url));
}

