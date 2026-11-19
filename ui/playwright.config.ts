// E2E (SPEC §9, §10): app de produção servido pelo `vite preview`, no Google Chrome instalado
// (NFR-08; Firefox e Safari entram na L06).
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `bun run build && bun run preview --port ${String(PORT)} --strictPort`,
    port: PORT,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 120_000,
  },
});
