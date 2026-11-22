// Regras das variáveis do build (SPEC §9.3, NFR-09). Funções puras: usadas pelo `src/env.ts`, pelo
// `vite.config.ts` e pelos testes.

const blank = (value: string | undefined): value is undefined | '' =>
  value === undefined || value.trim() === '';

/** `PUBLIC_SUPABASE_URL`: opcional; se vier, `http://` ou `https://`. */
export function checkSupabaseUrl(value: string | undefined): string | undefined {
  if (blank(value)) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`PUBLIC_SUPABASE_URL não é uma URL válida: "${value}".`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('PUBLIC_SUPABASE_URL deve começar com http:// ou https://.');
  }
  return value.trim();
}

/** Papel de um JWT (`anon`, `service_role`…), sem validar a assinatura; `null` se não for JWT. */
function jwtRole(token: string): string | null {
  const [, payload] = token.split('.');
  if (payload === undefined || token.split('.').length !== 3) return null;
  try {
    const json = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
    const role = (JSON.parse(json) as Record<string, unknown>)['role'];
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

/** `PUBLIC_SUPABASE_KEY`: opcional; nunca a chave de serviço, que ignora o RLS (NFR-09). */
export function checkSupabaseKey(value: string | undefined): string | undefined {
  if (blank(value)) return undefined;
  const key = value.trim();
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    throw new Error(
      'PUBLIC_SUPABASE_KEY recebeu a chave de serviço (secret/service_role). Use a chave pública ' +
        '(publishable/anon): a de serviço ignora o RLS e iria para o navegador.',
    );
  }
  return key;
}

export const PAIR_MESSAGE = 'Defina PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_KEY juntas (ou nenhuma).';

/** As duas ou nenhuma: só uma é erro de configuração (SPEC §9.3). */
export function checkSupabasePair(url: string | undefined, key: string | undefined): void {
  if (blank(url) !== blank(key)) throw new Error(PAIR_MESSAGE);
}
