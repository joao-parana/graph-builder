// Variáveis do build (SPEC §9.3), lidas de `$app/env/public`. `static: true`: o valor entra no
// bundle; sem as duas, o código da nuvem sai no tree-shaking e o app é a v1.
import { defineEnvVars } from '@sveltejs/kit/env';
import { checkSupabaseKey, checkSupabaseUrl } from './lib/cloud/env-rules.ts';

export const variables = defineEnvVars({
  PUBLIC_SUPABASE_URL: {
    public: true,
    static: true,
    description: 'URL do projeto Supabase do modo nuvem (ADR-0004). Opcional.',
    schema: checkSupabaseUrl,
  },
  PUBLIC_SUPABASE_KEY: {
    public: true,
    static: true,
    description: 'Chave pública (publishable/anon) do Supabase. Nunca a de serviço. Opcional.',
    schema: checkSupabaseKey,
  },
});
