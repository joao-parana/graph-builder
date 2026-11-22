import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { cspDirectives } from './src/lib/cloud/csp.ts';
import { checkSupabasePair } from './src/lib/cloud/env-rules.ts';

// SvelteKit 3: a configuração fica no plugin `sveltekit(...)` (não há mais svelte.config.js).
export default defineConfig(({ mode }) => {
  // SPEC §9.3: as duas variáveis do Supabase ou nenhuma (o resto é validado no src/env.ts).
  const env = { ...loadEnv(mode, process.cwd(), 'PUBLIC_'), ...process.env };
  checkSupabasePair(env['PUBLIC_SUPABASE_URL'], env['PUBLIC_SUPABASE_KEY']);
  return {
    plugins: [
      sveltekit({
        // ADR-0003: SPA estático, sem servidor (NFR-05).
        adapter: adapter({ fallback: 'index.html' }),
        // SPEC §9.2: subcaminho do GitHub Pages (`BASE_PATH=/graph-builder`); vazio, o app fica na raiz.
        paths: { base: (process.env['BASE_PATH'] ?? '') as '' | `/${string}` },
        // SPEC §9.4: CSP por `<meta>` (o Pages não permite cabeçalhos), com hash do script inline.
        csp: { mode: 'hash', directives: cspDirectives(env['PUBLIC_SUPABASE_URL']) },
        compilerOptions: {
          // ADR-0003: só runes; sem sintaxe legada.
          runes: true,
        },
      }),
    ],
    test: {
      include: ['src/**/*.test.ts'],
    },
  };
});
