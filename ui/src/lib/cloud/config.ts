// Configuração do modo nuvem (SPEC §9.3): `null` sem Supabase no build, e o app é a v1.
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { resolve } from '$app/paths';

export interface CloudConfig {
  readonly url: string;
  readonly key: string;
}

export function cloudConfigFrom(
  url: string | undefined,
  key: string | undefined,
): CloudConfig | null {
  return url === undefined || key === undefined ? null : { url, key };
}

export const cloudConfig: CloudConfig | null = cloudConfigFrom(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_KEY,
);

/** Volta do login: a raiz do app, com o subcaminho do Pages (FR-50, §9.2). */
export const redirectTo = (origin: string, root: string = resolve('/')): string =>
  `${origin}${root}`;
