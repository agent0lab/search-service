import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Delete session cookie
  response.cookies.delete('admin-session');
  return response;
}

