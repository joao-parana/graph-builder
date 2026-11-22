// E2E (SPEC §9, §10): app de produção servido pelo `vite preview`, no Google Chrome instalado e no
// Firefox e WebKit (motor do Safari) do Playwright (NFR-08).
// Com o Supabase local no ar, o build entra no modo nuvem com os valores do `supabase status` (Q9);
// sem ele, o build é a v1 e o `cloud.spec.ts` é pulado.
import { defineConfig, devices } from '@playwright/test';
import { CACHE, localCloud } from './e2e/local-cloud.ts';

const PORT = 4173;
const firstLoad = process.env[CACHE] === undefined;
const cloud = localCloud();
if (cloud === null && firstLoad) {
  console.warn('⚠ Supabase local fora do ar: e2e da nuvem pulados (rode `bun run db:start`).');
}

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
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `bun run build && bun run preview --port ${String(PORT)} --strictPort`,
    port: PORT,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 120_000,
    env:
      cloud === null
        ? {}
        : { PUBLIC_SUPABASE_URL: cloud.url, PUBLIC_SUPABASE_KEY: cloud.publicKey },
  },
});
