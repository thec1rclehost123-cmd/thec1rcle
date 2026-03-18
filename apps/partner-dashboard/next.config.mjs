import { withSentryConfig } from "@sentry/nextjs";
import "./lib/env.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@c1rcle/core', '@c1rcle/ui', '@c1rcle/types', 'framer-motion', 'lucide-react', 'recharts'],
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
    ignoreBuildErrors: false,
  },
  eslint: {
    dirs: ['app', 'components', 'lib'],
    ignoreDuringBuilds: true,
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
      { protocol: 'https', hostname: 'thec1rcle-india.firebasestorage.app', pathname: '/**' },
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
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  },
  async redirects() {
    return [
      { source: '/club/:path*', destination: '/venue/:path*', permanent: true },
      { source: '/api/club/:path*', destination: '/api/venue/:path*', permanent: true },
      { source: '/api/clubs/:path*', destination: '/api/venues/:path*', permanent: true }
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
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: process.env.SENTRY_ORG || "c1rcle",
    project: process.env.SENTRY_PROJECT || "partner-dashboard",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: true,

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  }
);
