// AuthGateway com o Supabase Auth e o GitHub (FR-50..52, FR-56; ADR-0004).
import type { User } from '@supabase/supabase-js';
import type { Account, AuthError, AuthGateway } from '../application/index.ts';
import { err, ok, type Result } from '../domain/index.ts';
import type { CloudClient } from './supabase-client.ts';

/** O que a URL de volta do login traz (query ou fragmento). */
export type AuthRedirect =
  | { readonly kind: 'none' }
  | { readonly kind: 'code'; readonly code: string; readonly cleanUrl: string }
  | { readonly kind: 'error'; readonly error: AuthError; readonly cleanUrl: string };

/** Parâmetros que o Supabase Auth põe na volta e o app tira da URL. */
const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description', 'sb', 'state'];

/** FR-51: descrição do Supabase Auth quando o cadastro está fechado e a volta vem sem o código. */
const SIGNUPS_NOT_ALLOWED = /signups not allowed/i;

/** Tira os parâmetros de auth; devolve o resto, já com `?`/`#`, ou vazio. */
function stripAuthParams(params: URLSearchParams, prefix: '?' | '#'): string {
  for (const name of AUTH_PARAMS) params.delete(name);
  const rest = params.toString();
  return rest === '' ? '' : `${prefix}${rest}`;
}

/**
 * Lê a volta do login (FR-50, FR-51): `?code=` (PKCE) ou erro, que o Supabase pode mandar na query
 * ou no fragmento. Sem convite: `error_code=signup_disabled` (Q7) ou, sem o código, a descrição
 * "Signups not allowed". Cancelado: `access_denied` sem nenhum dos dois.
 */
export function parseAuthRedirect(href: string): AuthRedirect {
  const url = new URL(href);
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.slice(1)); // `hash` vem com `#` ou vazio
  const read = (name: string): string | null => query.get(name) ?? fragment.get(name);

  const code = query.get('code');
  const error = read('error');
  if (code === null && error === null) return { kind: 'none' };

  // Um fragmento sem parâmetros de auth (ex.: `#topo`) fica como está.
  const authInFragment = AUTH_PARAMS.some((name) => fragment.has(name));
  const search = stripAuthParams(new URLSearchParams(query), '?');
  const hash = authInFragment ? stripAuthParams(new URLSearchParams(fragment), '#') : url.hash;
  const cleanUrl = `${url.origin}${url.pathname}${search}${hash}`;

  if (error === null && code !== null) return { kind: 'code', code, cleanUrl };
  const errorCode = read('error_code');
  const description = read('error_description') ?? '';
  if (errorCode === 'signup_disabled' || SIGNUPS_NOT_ALLOWED.test(description)) {
    return { kind: 'error', error: 'NOT_INVITED', cleanUrl };
  }
  if (error === 'access_denied' && errorCode === null) {
    return { kind: 'error', error: 'CANCELLED', cleanUrl };
  }
  return { kind: 'error', error: 'NETWORK', cleanUrl };
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/** Login do GitHub (`user_name`); sem ele, o e-mail ou o id. */
export function toAccount(user: User): Account {
  const meta = user.user_metadata;
  return {
    id: user.id,
    login: text(meta['user_name']) ?? text(meta['preferred_username']) ?? user.email ?? user.id,
    avatarUrl: text(meta['avatar_url']),
  };
}

/** Onde o app está e como trocar a URL sem recarregar (o navegador; os testes passam outro). */
export interface AuthLocation {
  href(): string;
  replace(url: string): void;
}

export const browserLocation: AuthLocation = {
  href: () => window.location.href,
  replace: (url) => {
    window.history.replaceState(window.history.state, '', url);
  },
};

export class SupabaseAuthGateway implements AuthGateway {
  private readonly client: CloudClient;
  private readonly redirectTo: string;
  private readonly location: AuthLocation;

  /** `redirectTo`: a raiz do app (no Pages, `/graph-builder/`), liberada no Supabase (§9.2). */
  constructor(client: CloudClient, redirectTo: string, location: AuthLocation = browserLocation) {
    this.client = client;
    this.redirectTo = redirectTo;
    this.location = location;
  }

  async account(): Promise<Account | null> {
    const { data } = await this.client.auth.getSession();
    return data.session === null ? null : toAccount(data.session.user);
  }

  async signIn(): Promise<void> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: this.redirectTo },
    });
    if (error !== null) throw error;
  }

  async completeSignIn(): Promise<Result<Account, AuthError> | null> {
    const redirect = parseAuthRedirect(this.location.href());
    if (redirect.kind === 'none') return null;
    this.location.replace(redirect.cleanUrl);
    if (redirect.kind === 'error') return err(redirect.error);
    const { data, error } = await this.client.auth.exchangeCodeForSession(redirect.code);
    if (error !== null) return err('NETWORK');
    return ok(toAccount(data.user));
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error !== null) throw error;
  }

  onChange(listener: (account: Account | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      listener(session === null ? null : toAccount(session.user));
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }
}
