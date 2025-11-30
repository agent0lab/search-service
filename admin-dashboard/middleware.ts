import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';

export const config = {
  matcher: '/dashboard/:path*',
};

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('admin-session')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const secret = process.env.SIWE_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const verification = await verifySessionToken(token, secret);

  if (!verification.valid || !verification.session) {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('admin-session');
    return response;
  }

  return NextResponse.next();
}

