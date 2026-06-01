import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

// Security headers applied to every response (SEC-2)
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval + unsafe-inline needed for Next.js dev HMR; lock down in prod
      isDev
        ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      // Allow backend WS in dev; tighten NEXT_PUBLIC_WS_URL in production .env
      `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'} ws://localhost:3001 wss:`,
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Running in standard server mode to support middleware-based auth redirects.
  // (output: 'export' was removed — static export is incompatible with Next.js middleware)
  distDir: '.next',

  // Allow Next.js Image component to load snapshots from the NestJS backend
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
        pathname: '/api/**',
      },
    ],
  },

  // Security headers on every page + API route (SEC-2)
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },

  // Rewrite /api/* to the backend in development — avoids browser CORS preflight
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
