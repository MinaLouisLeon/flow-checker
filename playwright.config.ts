import { defineConfig, devices } from '@playwright/test'

// End-to-end capture tests: the built CLI runs a fixture app with capture on, a browser uses
// the app, and the test checks what shows up in the dashboard. Run `pnpm build` first.
export const PORTS = { mockApi: 4010, dashboard: 4466, app: 3066 }

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node fixtures/mock-api/server.js',
      url: `http://127.0.0.1:${PORTS.mockApi}/users`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node packages/flow-checker/dist/cli.js dev --root fixtures/next-intl --no-open --port ${PORTS.dashboard} --app-port ${PORTS.app}`,
      // Wait for the app, not just the dashboard: the first compile takes a while.
      url: `http://localhost:${PORTS.app}/en/login`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
  ],
})
