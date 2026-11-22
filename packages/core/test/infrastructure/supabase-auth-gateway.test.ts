// Login e sessão (FR-50..52, FR-56; Q7): leitura da URL de volta, conta e mudanças de sessão.
import type { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type AuthLocation,
  type CloudClient,
  parseAuthRedirect,
  SupabaseAuthGateway,
  toAccount,
} from '../../src/infrastructure/index.ts';
import { anonymousClient, createTestUser, local, type TestUser } from './supabase-local.ts';

const APP = 'https://joao-parana.github.io/graph-builder/';

describe('parseAuthRedirect (FR-50, FR-51)', () => {
  it('página comum: nada a fazer', () => {
    expect(parseAuthRedirect(APP)).toEqual({ kind: 'none' });
    expect(parseAuthRedirect(`${APP}?x=1#topo`)).toEqual({ kind: 'none' });
  });

  it('?code= do PKCE; a URL limpa guarda o resto', () => {
    expect(parseAuthRedirect(`${APP}?x=1&code=abc&state=s#topo`)).toEqual({
      kind: 'code',
      code: 'abc',
      cleanUrl: `${APP}?x=1#topo`,
    });
  });

  it('sem convite (Q7): signup_disabled, na query ou no fragmento', () => {
    const fragment = `${APP}#error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed&sb=`;
    expect(parseAuthRedirect(fragment)).toEqual({
      kind: 'error',
      error: 'NOT_INVITED',
      cleanUrl: APP,
    });
    expect(
      parseAuthRedirect(`${APP}?error=access_denied&error_code=signup_disabled`),
    ).toMatchObject({ error: 'NOT_INVITED', cleanUrl: APP });
  });

  it('cancelado no GitHub: access_denied sem código de erro', () => {
    expect(parseAuthRedirect(`${APP}?error=access_denied&error_description=x`)).toEqual({
      kind: 'error',
      error: 'CANCELLED',
      cleanUrl: APP,
    });
  });

  it('outro erro (servidor, rede): NETWORK, mesmo com code junto', () => {
    expect(
      parseAuthRedirect(`${APP}#error=server_error&error_code=unexpected_failure`),
    ).toMatchObject({ error: 'NETWORK' });
    expect(parseAuthRedirect(`${APP}?code=abc&error=server_error`)).toMatchObject({
      error: 'NETWORK',
    });
  });
});

const user = (meta: Record<string, unknown>, email?: string): User =>
  ({ id: 'u1', email, user_metadata: meta }) as unknown as User;

describe('toAccount', () => {
  it('login do GitHub e avatar', () => {
    expect(toAccount(user({ user_name: 'joao', avatar_url: 'https://a/x.png' }))).toEqual({
      id: 'u1',
      login: 'joao',
      avatarUrl: 'https://a/x.png',
    });
  });

  it('sem user_name: preferred_username, depois e-mail, depois id', () => {
    expect(toAccount(user({ preferred_username: 'jp', avatar_url: '' })).login).toBe('jp');
    expect(toAccount(user({}, 'j@x.test'))).toEqual({
      id: 'u1',
      login: 'j@x.test',
      avatarUrl: null,
    });
    expect(toAccount(user({})).login).toBe('u1');
  });
});

/** Location falsa: guarda a URL trocada. */
function fakeLocation(href: string): AuthLocation & { replaced: string[] } {
  const replaced: string[] = [];
  return { replaced, href: () => href, replace: (url) => replaced.push(url) };
}

/** Cliente falso só com o que o caso usa. */
const fakeClient = (auth: Record<string, unknown>): CloudClient =>
  ({ auth }) as unknown as CloudClient;

describe('SupabaseAuthGateway.completeSignIn (FR-50, FR-51)', () => {
  it('página comum: null, sem mexer na URL', async () => {
    const location = fakeLocation(APP);
    const gateway = new SupabaseAuthGateway(fakeClient({}), APP, location);
    expect(await gateway.completeSignIn()).toBeNull();
    expect(location.replaced).toEqual([]);
  });

  it('erro na volta: limpa a URL e devolve o motivo', async () => {
    const location = fakeLocation(`${APP}#error=access_denied&error_code=signup_disabled`);
    const gateway = new SupabaseAuthGateway(fakeClient({}), APP, location);
    expect(await gateway.completeSignIn()).toEqual({ ok: false, error: 'NOT_INVITED' });
    expect(location.replaced).toEqual([APP]);
  });

  it('code válido: troca pela sessão e devolve a conta', async () => {
    const exchange = vi.fn(() =>
      Promise.resolve({ data: { user: user({ user_name: 'joao' }) }, error: null }),
    );
    const location = fakeLocation(`${APP}?code=abc`);
    const gateway = new SupabaseAuthGateway(
      fakeClient({ exchangeCodeForSession: exchange }),
      APP,
      location,
    );
    expect(await gateway.completeSignIn()).toEqual({
      ok: true,
      value: { id: 'u1', login: 'joao', avatarUrl: null },
    });
    expect(exchange).toHaveBeenCalledWith('abc');
    expect(location.replaced).toEqual([APP]);
  });

  it('signIn e signOut repassam o erro do Supabase', async () => {
    const failure = { message: 'falhou' };
    const gateway = new SupabaseAuthGateway(
      fakeClient({
        signInWithOAuth: () => Promise.resolve({ data: {}, error: failure }),
        signOut: () => Promise.resolve({ error: failure }),
      }),
      APP,
      fakeLocation(APP),
    );
    await expect(gateway.signIn()).rejects.toBe(failure);
    await expect(gateway.signOut()).rejects.toBe(failure);
  });
});

describe.skipIf(local === null)('SupabaseAuthGateway (Supabase local)', () => {
  let users: TestUser[] = [];
  afterEach(async () => {
    await Promise.all(users.map((u) => u.remove()));
    users = [];
  });
  const env = () => {
    if (local === null) throw new Error('Supabase local fora do ar');
    return local;
  };

  it('sem sessão: account → null; signIn vai ao GitHub sem erro', async () => {
    const client = anonymousClient(env());
    const spy = vi.spyOn(client.auth, 'signInWithOAuth');
    const gateway = new SupabaseAuthGateway(client, APP, fakeLocation(APP));
    expect(await gateway.account()).toBeNull();
    await gateway.signIn();
    expect(spy).toHaveBeenCalledWith({ provider: 'github', options: { redirectTo: APP } });
  });

  it('code inválido (sem verificador PKCE): NETWORK', async () => {
    const gateway = new SupabaseAuthGateway(
      anonymousClient(env()),
      APP,
      fakeLocation(`${APP}?code=invalido`),
    );
    expect(await gateway.completeSignIn()).toEqual({ ok: false, error: 'NETWORK' });
  });

  it('com sessão: account; sair avisa quem escuta (FR-52, FR-56)', async () => {
    const test = await createTestUser(env());
    users.push(test);
    const gateway = new SupabaseAuthGateway(test.client, APP, fakeLocation(APP));
    expect(await gateway.account()).toEqual({ id: test.id, login: test.email, avatarUrl: null });

    const seen: (string | null)[] = [];
    const stop = gateway.onChange((account) => seen.push(account?.id ?? null));
    await gateway.signOut();
    await vi.waitFor(() => {
      expect(seen.at(-1)).toBeNull();
    });
    stop();
    expect(await gateway.account()).toBeNull();
  });
});
