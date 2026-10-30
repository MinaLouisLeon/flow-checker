import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  compiler: {
    // Turns graphql`...` tags into imports of the compiled artifacts. Matches relay.config.json.
    relay: {
      src: './src',
      artifactDirectory: './src/__generated__',
      language: 'typescript',
      eagerEsModules: true,
    },
  },
}

export default nextConfig
