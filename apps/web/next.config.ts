import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@flashchat/shared'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
    ],
  },
}

export default nextConfig
