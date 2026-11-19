// Supabase local para os testes da nuvem (SPEC §10, NFR-10). Nunca aponta para produção: a URL e as
// chaves vêm do `supabase status` do CLI do projeto (Docker). Sem ele no ar, os testes são pulados.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  type CloudClient,
  type CloudDatabase,
  createCloudClient,
} from '../../src/infrastructure/index.ts';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

export interface LocalSupabase {
  readonly url: string;
  readonly publicKey: string;
  readonly serviceKey: string;
}

export function readStatus(): LocalSupabase | null {
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
    if (
      typeof url !== 'string' ||
      typeof publicKey !== 'string' ||
      typeof serviceKey !== 'string'
    ) {
      return null;
    }
    return { url, publicKey, serviceKey };
  } catch {
    return null;
  }
}

/** `null` quando o Supabase local não está no ar (`bun run db:start`). */
export const local: LocalSupabase | null = readStatus();

/** Sessão em memória: cada cliente de teste é um "navegador" separado. */
export function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

/** Cliente com a *service role key*: só cria e apaga usuários de teste e semeia linhas. */
export function adminClient(env: LocalSupabase): CloudClient {
  return createClient<CloudDatabase>(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente sem sessão (papel anônimo). */
export const anonymousClient = (env: LocalSupabase): CloudClient =>
  createCloudClient(env.url, env.publicKey, { storage: memoryStorage() });

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly client: CloudClient;
  remove(): Promise<void>;
}

/** Usuário novo (como um convidado), já com sessão num cliente próprio. */
export async function createTestUser(env: LocalSupabase): Promise<TestUser> {
  const admin = adminClient(env);
  const email = `teste-${randomUUID()}@graph-builder.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error !== null) throw created.error;
  const { id } = created.data.user;
  const client = anonymousClient(env);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error !== null) throw signedIn.error;
  return {
    id,
    email,
    client,
    remove: async () => {
      await client.auth.signOut();
      const removed = await admin.auth.admin.deleteUser(id);
      if (removed.error !== null) throw removed.error;
    },
  };
}
