import { withSentryConfig } from '@sentry/nextjs';
import './lib/env.mjs';
import { resolveGuestApiOrigin } from './lib/api/base-url.mjs';

const gatewayOrigin = resolveGuestApiOrigin(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@c1rcle/core', '@c1rcle/ui', '@c1rcle/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'lodash', 'framer-motion', 'react-icons'],
  },
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  // eslint linting during builds is disabled via `next build --no-lint`
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'storage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: 'c1rcle-staging.firebasestorage.app', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'api.dicebear.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.pravatar.cc', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' },
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
    ];
  },
  async redirects() {
    return [{ source: '/club/:path*', destination: '/venue/:path*', permanent: true }];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${gatewayOrigin}/api/v1/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.ignoreWarnings = [{ module: /@opentelemetry/ }, { module: /@sentry/ }];
    return config;
  },
};

// Skip Sentry wrapping in development — it adds compilation overhead and network calls.
const finalConfig =
  process.env.NODE_ENV === 'development'
    ? nextConfig
    : withSentryConfig(
        nextConfig,
        {
          silent: true,
          org: process.env.SENTRY_ORG || 'c1rcle',
          project: process.env.SENTRY_PROJECT || 'guest-portal',
        },
        {
          widenClientFileUpload: true,
          transpileClientSDK: true,
          hideSourceMaps: true,
          disableLogger: true,
          automaticVercelMonitors: true,
        },
      );

export default finalConfig;
