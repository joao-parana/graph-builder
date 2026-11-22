// CSP do build (SPEC §9.4, NFR-09). Função pura: usada pelo `vite.config.ts` (`kit.csp`) e pelos
// testes. O SvelteKit põe a política numa `<meta>` do `index.html` e soma ao `script-src` o hash do
// script inline de inicialização.
import type { sveltekit } from '@sveltejs/kit/vite';
import { checkSupabaseUrl } from './env-rules.ts';

/** O SvelteKit não exporta o tipo das diretivas; sai da própria configuração. */
type KitOptions = NonNullable<Parameters<typeof sveltekit>[0]>;
export type CspDirectives = NonNullable<NonNullable<KitOptions['csp']>['directives']>;

/** Diretivas da CSP; o `connect-src` libera só a origem do Supabase, se houver (NFR-05). */
export function cspDirectives(supabaseUrl?: string): CspDirectives {
  const url = checkSupabaseUrl(supabaseUrl);
  const supabase =
    url === undefined ? [] : [new URL(url).origin as `${string}://${string}.${string}`];
  return {
    'default-src': ['self'],
    'script-src': ['self'],
    // O @xyflow/svelte e as diretivas `style:` do Svelte usam atributos `style`.
    'style-src': ['self', 'unsafe-inline'],
    'img-src': ['self', 'data:'],
    'font-src': ['self'],
    'connect-src': ['self', ...supabase],
    'object-src': ['none'],
    'base-uri': ['self'],
    'form-action': ['none'],
  };
}
