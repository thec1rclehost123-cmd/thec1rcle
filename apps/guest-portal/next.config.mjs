/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@c1rcle/core', '@c1rcle/ui'],
  // Disabled optimizePackageImports for framer-motion due to Next.js 14.2.x bug
  typescript: {
    // Enforce type checking during build for production safety (Fix: Build Safety is Disabled)
    ignoreBuildErrors: false,
  },
  eslint: {
    // Enforce linting during build for production safety
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com', // Fix: External Single Point of Failure (Allowing Dicebear)
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/club/:path*',
        destination: '/venue/:path*',
        permanent: true,
      },
      {
        source: '/clubs/:path*',
        destination: '/venue/:path*',
        permanent: true,
      },
      {
        source: '/venues/:slug',
        destination: '/venue/:slug',
        permanent: true,
      },
      {
        source: '/hosts/:slug',
        destination: '/host/:slug',
        permanent: true,
      }
    ]
  }
};

export default nextConfig;
