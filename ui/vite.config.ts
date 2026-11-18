import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// SvelteKit 3: a configuração fica no plugin `sveltekit(...)` (não há mais svelte.config.js).
export default defineConfig({
  plugins: [
    sveltekit({
      // ADR-0003: SPA estático, sem servidor (NFR-05).
      adapter: adapter({ fallback: 'index.html' }),
      compilerOptions: {
        // ADR-0003: só runes; sem sintaxe legada.
        runes: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
