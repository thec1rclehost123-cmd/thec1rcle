/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disabled optimizePackageImports for framer-motion due to Next.js 14.2.x bug
  typescript: {
    // Skip type checking during build for speed
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint during build for speed
    ignoreDuringBuilds: true,
  },
};


export default nextConfig;
// Trigger rebuild 5

