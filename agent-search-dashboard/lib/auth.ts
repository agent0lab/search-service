import { SignJWT, jwtVerify } from 'jose';
import type { Session } from './types';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSessionToken(address: string, secret: string): Promise<string> {
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION;

  const token = await new SignJWT({ address })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(new TextEncoder().encode(secret));

  return token;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<{ valid: boolean; session?: Session; error?: string }> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    if (!payload.address || typeof payload.address !== 'string') {
      return { valid: false, error: 'Invalid token payload' };
    }

    const session: Session = {
      address: payload.address,
      issuedAt: (payload.iat as number) * 1000,
      expiresAt: (payload.exp as number) * 1000,
    };

    return { valid: true, session };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token verification failed',
    };
  }
}

export function getSessionCookieName(): string {
  return 'admin-session';
}

export function getSessionCookieOptions(isProduction: boolean = false) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  };
}

