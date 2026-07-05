import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password');
  const isDashboard = pathname.startsWith('/live') || pathname.startsWith('/cameras') || pathname.startsWith('/events') || pathname.startsWith('/alerts') || pathname.startsWith('/faces') || pathname.startsWith('/zones') || pathname.startsWith('/analytics') || pathname.startsWith('/settings') || pathname === '/' || pathname.startsWith('/dashboard');

  const token = request.cookies.get('auth-token')?.value;

  if (isDashboard && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|grid.svg|.*\\..*).*)'],
};
