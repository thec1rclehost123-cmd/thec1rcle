import { withSentryConfig } from '@sentry/nextjs';
import './lib/env.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@c1rcle/core',
    '@c1rcle/ui',
    '@c1rcle/types',
    'framer-motion',
    'lucide-react',
    'recharts',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
  ],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'lodash',
      'framer-motion',
      'react-icons',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
    ],
  },
  productionBrowserSourceMaps: false,
  devIndicators: {
    buildActivityPosition: 'bottom-right',
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Explicitly set supported formats (avoids 400s from unsupported format negotiation)
    formats: ['image/avif', 'image/webp'],
    // Cache optimised images for 24 hours to reduce 400-retry storms
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'storage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'c1rcle-staging.firebasestorage.app', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'api.dicebear.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.pravatar.cc', pathname: '/**' },
      { protocol: 'https', hostname: 'ideogram.ai', pathname: '/**' },
      { protocol: 'https', hostname: '*.ideogram.ai', pathname: '/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-scanner-code, x-venue-id, x-host-id, x-partner-id, x-workspace-id, x-request-id',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/club/:path*', destination: '/venue/:path*', permanent: true },
      { source: '/api/club/:path*', destination: '/api/venue/:path*', permanent: true },
      { source: '/api/clubs/:path*', destination: '/api/venues/:path*', permanent: true },
    ];
  },
  async rewrites() {
    const gatewayUrl = process.env.GATEWAY_URL || 'http://127.0.0.1:4000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${gatewayUrl}/api/v1/:path*`,
      },
    ];
  },
};

// Skip Sentry wrapper in local development — it adds webpack overhead on every HMR cycle
const isDev = process.env.NODE_ENV === 'development';

export default isDev
  ? nextConfig
  : withSentryConfig(
      nextConfig,
      {
        silent: true,
        org: process.env.SENTRY_ORG || 'c1rcle',
        project: process.env.SENTRY_PROJECT || 'partner-dashboard',
      },
      {
        widenClientFileUpload: true,
        transpileClientSDK: true,
        hideSourceMaps: true,
        disableLogger: true,
        automaticVercelMonitors: true,
      },
    );
