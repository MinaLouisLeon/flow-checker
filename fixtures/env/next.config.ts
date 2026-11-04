import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Inlined into server and client code alike.
  env: { BUILD_LABEL: 'fixture-value-build-label' },
  // Read when Next starts; unset means off.
  poweredByHeader: process.env.POWERED_BY === 'on',
}

export default nextConfig
