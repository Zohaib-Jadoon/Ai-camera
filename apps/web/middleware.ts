import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DASHBOARD_PREFIX = [
  '/dashboard',
  '/cameras',
  '/live',
  '/alerts',
  '/analytics',
  '/events',
  '/faces',
  '/zones',
  '/settings',
  '/training',
  '/alert-rules',
  '/calibration',
  '/camera-groups',
  '/escalation',
  '/forecast',
  '/recordings',
  '/reid',
  '/safety',
  '/traffic',
  '/users',
  '/webhooks',
];
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

function isAuthenticated(req: NextRequest): boolean {
  // Cookie set by the login page after successful auth
  return !!req.cookies.get('auth-token')?.value;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = isAuthenticated(req);

  // Protect all dashboard routes
  if (DASHBOARD_PREFIX.some((p) => pathname.startsWith(p))) {
    if (!authed) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect already-authenticated users away from auth pages
  if (AUTH_PATHS.includes(pathname) && authed) {
    const dashUrl = req.nextUrl.clone();
    dashUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static / _next/image (Next.js internals)
     * - favicon.ico
     * - /api/* (backend proxy)
     * - public files (e.g. images, fonts)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)',
  ],
};
