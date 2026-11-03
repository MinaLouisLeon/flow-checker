import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `forbidden()` and `unauthorized()` need it.
  experimental: { authInterrupts: true },
}

export default nextConfig
