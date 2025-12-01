import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Delete session cookie
  response.cookies.delete('admin-session');
  return response;
}

