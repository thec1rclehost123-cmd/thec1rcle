import { withSentryConfig } from "@sentry/nextjs";
import "./lib/env.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@c1rcle/core', '@c1rcle/ui', '@c1rcle/types'],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "lodash",
      "framer-motion",
      "react-icons",
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage"
    ],
    instrumentationHook: true,
  },
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
      { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' }
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
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/club/:path*', destination: '/venue/:path*', permanent: true },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4000/api/v1/:path*' // Proxy to API Gateway running on port 4000
      }
    ]
  }
};

export default withSentryConfig(
  nextConfig,
  {
    silent: true,
    org: process.env.SENTRY_ORG || "c1rcle",
    project: process.env.SENTRY_PROJECT || "guest-portal",
  },
  {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    hideSourceMaps: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  }
);
