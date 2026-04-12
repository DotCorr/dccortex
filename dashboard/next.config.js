/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // CI/docker images should still build while the repo has existing lint debt.
    ignoreDuringBuilds: true,
  },
  // Allow dev server to accept requests from tunnel domain (hostnames only per Next.js doc)
  allowedDevOrigins: ['dccortex.com', 'www.dccortex.com', 'active.dccortex.com'],
  env: {
    PLATFORM_API_URL: process.env.PLATFORM_API_URL || 'http://platform-api:3001',
    NEXT_PUBLIC_PLATFORM_API_URL: process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'https://api.dccortex.com',
  },
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    const noCache = [
      { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
      { key: 'Pragma', value: 'no-cache' },
    ]
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      { source: '/', headers: [...noCache, ...securityHeaders] },
      { source: '/login', headers: [...noCache, ...securityHeaders] },
      { source: '/organizations/:path*', headers: [...noCache, ...securityHeaders] },
      { source: '/dashboard/:path*', headers: [...noCache, ...securityHeaders] },
      { source: '/apps/:path*', headers: [...noCache, ...securityHeaders] },
      { source: '/projects/:path*', headers: [...noCache, ...securityHeaders] },
      {
        source: '/api/auth/:path*',
        headers: [...noCache, ...securityHeaders],
      },
      {
        source: '/api/projects/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Access-Control-Allow-Origin', value: 'https://dccortex.com' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-Token' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Access-Control-Allow-Origin', value: 'https://dccortex.com' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-Token' },
        ],
      },
    ]
  },
  // Rewrite legacy /uploads/* URLs to the API route that serves files from disk
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Fix NextAuth CSS parsing issue
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }
    
    // Ignore next-auth CSS file
    config.module.rules.push({
      test: /node_modules\/next-auth\/css\/index\.js$/,
      type: 'asset/source',
    })

    return config
  },
}

module.exports = nextConfig

