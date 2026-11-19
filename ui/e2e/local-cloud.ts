// Supabase local para o e2e da nuvem (Q9, SPEC §10). Nunca aponta para produção: a URL e as chaves
// vêm do `supabase status` do CLI do projeto (Docker). Sem ele no ar, `localCloud()` é `null`.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface LocalCloud {
  readonly url: string;
  readonly publicKey: string;
  /** Só no processo do Playwright: cria e apaga usuários de teste. Nunca vai para o build. */
  readonly serviceKey: string;
}

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** O config roda em cada processo do Playwright; o primeiro lê o status e os outros herdam. */
export const CACHE = 'GRAPH_BUILDER_E2E_CLOUD';

function readStatus(): LocalCloud | null {
  try {
    const out = execFileSync(`${ROOT}node_modules/.bin/supabase`, ['status', '-o', 'json'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 30_000,
    }).toString();
    const status = JSON.parse(out.slice(out.indexOf('{'))) as Record<string, unknown>;
    const url = status['API_URL'];
    const publicKey = status['PUBLISHABLE_KEY'] ?? status['ANON_KEY'];
    const serviceKey = status['SERVICE_ROLE_KEY'];
    if (typeof url !== 'string' || typeof publicKey !== 'string') return null;
    if (typeof serviceKey !== 'string') return null;
    return { url, publicKey, serviceKey };
  } catch {
    return null;
  }
}

export function localCloud(): LocalCloud | null {
  const cached = process.env[CACHE];
  if (cached !== undefined) return cached === '' ? null : (JSON.parse(cached) as LocalCloud);
  const cloud = readStatus();
  process.env[CACHE] = cloud === null ? '' : JSON.stringify(cloud);
  return cloud;
}
