import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'packages/*/test/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Many tests scan whole fixture apps, which takes 4-6 s when every file runs in parallel on a CI
    // runner: the 5 s default made them fail at random.
    testTimeout: 30_000,
  },
})
