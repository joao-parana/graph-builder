// Usuário de teste e sessão injetada (Q9): cria pela API admin do Supabase local, entra com senha e
// põe a sessão no `localStorage` antes de o app abrir. Sem `supabase-js`: só `fetch`.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { LocalCloud } from './local-cloud.ts';

export interface CloudSession {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly user: { readonly id: string };
}

export interface CloudUser {
  readonly login: string;
  readonly session: CloudSession;
  remove(): Promise<void>;
}

/** Uma nova tentativa em 5xx: sob a carga do e2e, o auth local às vezes estoura o timeout (504). */
async function call(url: string, init: RequestInit): Promise<unknown> {
  let response = await fetch(url, init);
  if (response.status >= 500) response = await fetch(url, init);
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${url}: ${String(response.status)}`);
  return response.status === 204 ? null : response.json();
}

const json = (key: string, token = key) => ({
  apikey: key,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

/** Um convidado: criado pelo admin (o cadastro está fechado) e já com sessão. */
export async function createUser(cloud: LocalCloud): Promise<CloudUser> {
  const login = `e2e-${randomUUID().slice(0, 8)}`;
  const email = `${login}@example.test`;
  const password = randomUUID();
  const admin = json(cloud.serviceKey);
  const user = (await call(`${cloud.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { user_name: login },
    }),
  })) as { id: string };
  const session = (await call(`${cloud.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cloud.publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })) as CloudSession;
  return {
    login,
    session,
    remove: async () => {
      await call(`${cloud.url}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: admin,
      });
    },
  };
}

/** Chave padrão do `supabase-js`: `sb-<primeiro rótulo do host>-auth-token`. */
export const storageKey = (cloud: LocalCloud): string =>
  `sb-${new URL(cloud.url).hostname.split('.')[0] ?? ''}-auth-token`;

/** Só na primeira carga da aba: recarregar depois de "Sair" não devolve a sessão. */
export async function injectSession(page: Page, cloud: LocalCloud, session: CloudSession) {
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem('e2e-session') !== null) return;
      sessionStorage.setItem('e2e-session', '1');
      localStorage.setItem(key, value);
    },
    [storageKey(cloud), JSON.stringify(session)] as const,
  );
}

/** Linhas da tabela `graphs` que o usuário vê (RLS). */
export async function cloudGraphs(cloud: LocalCloud, session: CloudSession) {
  return (await call(`${cloud.url}/rest/v1/graphs?select=id,name,node_count`, {
    headers: json(cloud.publicKey, session.access_token),
  })) as { id: string; name: string; node_count: number }[];
}
