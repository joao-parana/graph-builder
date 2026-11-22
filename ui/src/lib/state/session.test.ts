import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type Account,
  type AuthError,
  type AuthGateway,
  err,
  NodeKind,
  ok,
  type Result,
} from '@graph-builder/core';
import { ptBR } from '#lib/i18n/pt-BR.ts';
import { Editor } from './editor.svelte.ts';
import { type KeyValueStore, MODE_KEY } from './mode-preference.ts';
import { Session } from './session.svelte.ts';
import { testContext } from './test-context.ts';
import { MemoryRepo } from './test-repo.ts';
import { Workspace } from './workspace.svelte.ts';

const ana: Account = { id: 'u1', login: 'ana', avatarUrl: null };

class FakeGateway implements AuthGateway {
  current: Account | null = null;
  returned: Result<Account, AuthError> | null = null;
  signInFails = false;
  signIns = 0;
  private listener: ((account: Account | null) => void) | null = null;

  account(): Promise<Account | null> {
    return Promise.resolve(this.current);
  }
  signIn(): Promise<void> {
    this.signIns += 1;
    return this.signInFails ? Promise.reject(new Error('rede')) : Promise.resolve();
  }
  completeSignIn(): Promise<Result<Account, AuthError> | null> {
    return Promise.resolve(this.returned);
  }
  signOut(): Promise<void> {
    this.emit(null);
    return Promise.reject(new Error('sem rede'));
  }
  onChange(listener: (account: Account | null) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  emit(account: Account | null): void {
    this.listener?.(account);
  }
}

class MapStore implements KeyValueStore {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function setup(options: { cloud?: boolean; online?: boolean; loadFails?: boolean } = {}) {
  const editor = new Editor(testContext());
  const local = new MemoryRepo();
  const cloudRepo = new MemoryRepo();
  const gateway = new FakeGateway();
  const store = new MapStore();
  const workspace = new Workspace(editor, local);
  const messages: string[] = [];
  const notify = (message: string) => {
    messages.push(message);
  };
  vi.spyOn(editor, 'notify').mockImplementation(notify);
  const session = new Session({
    workspace,
    local,
    cloud:
      options.cloud === false
        ? null
        : () =>
            options.loadFails === true
              ? Promise.reject(new Error('chunk'))
              : Promise.resolve({ gateway, repo: cloudRepo }),
    notify,
    store,
    online: () => options.online ?? true,
  });
  return { editor, local, cloudRepo, gateway, store, workspace, session, messages };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Session — início (FR-50, FR-51, Q8)', () => {
  it('sem nuvem no build: só o modo local, como a v1', async () => {
    const { session, local } = setup({ cloud: false });
    await session.start();
    expect(session.cloudAvailable).toBe(false);
    expect(session.mode).toBe('local');
    expect(local.graphs.size).toBe(1);
    expect(session.copyTarget).toBeNull();
  });

  it('adaptadores da nuvem que não carregam (offline): só o modo local', async () => {
    const { session, local } = setup({ loadFails: true });
    expect(session.cloudAvailable).toBe(true);
    await session.start();
    expect(session.cloudAvailable).toBe(false);
    expect(session.mode).toBe('local');
    expect(local.graphs.size).toBe(1);
  });

  it('volta do login com sucesso: conta, modo nuvem e preferência gravada', async () => {
    const { session, gateway, cloudRepo, store } = setup();
    gateway.returned = ok(ana);
    await session.start();
    expect(session.account).toEqual(ana);
    expect(session.mode).toBe('cloud');
    expect(cloudRepo.graphs.size).toBe(1);
    expect(store.values.get(MODE_KEY)).toBe('cloud');
    expect(session.copyTarget).toBe('local');
    expect(session.signingIn).toBe(false);
  });

  it('sem convite: aviso de login (não toast) e modo local; cancelado: sem aviso', async () => {
    const first = setup();
    first.gateway.returned = err('NOT_INVITED');
    await first.session.start();
    expect(first.session.mode).toBe('local');
    expect(first.session.account).toBeNull();
    expect(first.session.notice).toBe(ptBR.cloud.notInvited);
    expect(first.messages).toEqual([]);
    vi.advanceTimersByTime(10_000);
    expect(first.session.notice).toBe(ptBR.cloud.notInvited);
    first.session.dismissNotice();
    expect(first.session.notice).toBeNull();

    const second = setup();
    second.gateway.returned = err('CANCELLED');
    await second.session.start();
    expect(second.session.notice).toBeNull();
    expect(second.messages).toEqual([]);

    const third = setup();
    third.gateway.returned = err('NETWORK');
    await third.session.start();
    expect(third.session.notice).toBe(ptBR.cloud.signInFailed);
    expect(third.messages).toEqual([]);
  });

  it('abre na nuvem só com sessão válida e modo lembrado', async () => {
    const remembered = setup();
    remembered.gateway.current = ana;
    remembered.store.setItem(MODE_KEY, 'cloud');
    await remembered.session.start();
    expect(remembered.session.mode).toBe('cloud');

    const noSession = setup();
    noSession.store.setItem(MODE_KEY, 'cloud');
    await noSession.session.start();
    expect(noSession.session.mode).toBe('local');
    expect(noSession.session.copyTarget).toBeNull();
  });

  it('nuvem fora do ar ao abrir: aviso e modo local', async () => {
    const { session, gateway, store, cloudRepo, local, messages } = setup();
    gateway.current = ana;
    store.setItem(MODE_KEY, 'cloud');
    cloudRepo.list = () => Promise.reject(new Error('fetch failed'));
    await session.start();
    expect(session.mode).toBe('local');
    expect(local.graphs.size).toBe(1);
    expect(messages).toEqual([ptBR.cloud.saveFailed('fetch failed')]);
  });
});

describe('Session — modos e cópia (FR-52..55)', () => {
  it('troca de modo só com sessão e lembra a escolha', async () => {
    const { session, gateway, store } = setup();
    await session.start();
    await session.switchMode('cloud');
    expect(session.mode).toBe('local');

    gateway.emit(ana);
    await session.switchMode('cloud');
    expect(session.mode).toBe('cloud');
    expect(store.values.get(MODE_KEY)).toBe('cloud');
    await session.switchMode('cloud');
    await session.switchMode('local');
    expect(session.mode).toBe('local');
    expect(store.values.get(MODE_KEY)).toBe('local');
  });

  it('troca para a nuvem que falha: fica no local sem gravar a preferência', async () => {
    const { session, gateway, store, cloudRepo } = setup();
    gateway.current = ana;
    await session.start();
    cloudRepo.list = () => Promise.reject(new Error('fetch failed'));
    await session.switchMode('cloud');
    expect(session.mode).toBe('local');
    expect(store.values.has(MODE_KEY)).toBe(false);
  });

  it('copia para o outro modo e avisa; falha vira toast', async () => {
    const { session, gateway, editor, cloudRepo, local, messages } = setup();
    gateway.current = ana;
    await session.start();
    const id = editor.graph.id;
    expect(await session.copyTo(id)).toBe(true);
    expect(cloudRepo.graphs.size).toBe(1);
    expect(messages).toEqual([ptBR.cloud.copied.cloud]);

    await session.switchMode('cloud');
    const cloudId = editor.graph.id;
    expect(await session.copyTo(cloudId)).toBe(true);
    expect(local.graphs.size).toBe(2);
    expect(messages.at(-1)).toBe(ptBR.cloud.copied.local);

    local.fail = true;
    expect(await session.copyTo(cloudId)).toBe(false);
    expect(messages.at(-1)).toBe(ptBR.cloud.saveFailed('quota'));
  });

  it('sem conexão, a falha da nuvem tem texto próprio', () => {
    const { session } = setup({ online: false });
    expect(session.describeCloudFailure(new Error('x'))).toBe(ptBR.cloud.offline);
    const cloudError = Object.assign(new Error('Não foi possível salvar'), {
      reason: 'JWT expired',
    });
    expect(setup().session.describeCloudFailure(cloudError)).toBe(
      ptBR.cloud.saveFailed('JWT expired'),
    );
    expect(setup().session.describeCloudFailure('texto')).toBe(ptBR.cloud.saveFailed('texto'));
  });

  it('sair grava o pendente, encerra a sessão sem aviso de expirada e volta ao local', async () => {
    const { session, gateway, editor, cloudRepo, store, messages } = setup();
    gateway.returned = ok(ana);
    await session.start();
    const id = editor.graph.id;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    session['workspace'].schedule();
    await session.signOut();
    expect(cloudRepo.graphs.get(id)?.nodes).toHaveLength(1);
    expect(session.account).toBeNull();
    expect(session.mode).toBe('local');
    expect(store.values.get(MODE_KEY)).toBe('local');
    expect(messages).toEqual([]);
    session.stop();
  });
});

describe('Session — login e sessão expirada (FR-50, FR-56)', () => {
  it('sessão que cai: "não salvo" e aviso; entrar guarda o grafo neste navegador', async () => {
    const { session, gateway, editor, workspace, local, cloudRepo, messages } = setup();
    gateway.returned = ok(ana);
    await session.start();
    const id = editor.graph.id;
    gateway.emit(null);
    expect(session.account).toBeNull();
    expect(workspace.status).toBe('error');
    expect(messages).toEqual([ptBR.cloud.expired]);
    gateway.emit(null);
    expect(messages).toHaveLength(1);

    cloudRepo.fail = true;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    workspace.schedule();
    await session.signIn();
    expect(local.graphs.get(id)?.nodes).toHaveLength(1);
    expect(messages).toContain(ptBR.cloud.keptLocally);
    expect(gateway.signIns).toBe(1);
    expect(session.signingIn).toBe(true);
    await session.signIn();
    expect(gateway.signIns).toBe(1);
  });

  it('no modo local, entrar só grava o pendente; falha ao sair para o GitHub vira toast', async () => {
    const { session, gateway, local, messages } = setup();
    await session.start();
    gateway.signInFails = true;
    await session.signIn();
    expect(local.graphs.size).toBe(1);
    expect(session.signingIn).toBe(false);
    expect(messages).toEqual([ptBR.cloud.signInFailed]);
  });

  it('sem nuvem no build, entrar e sair não fazem nada', async () => {
    const { session } = setup({ cloud: false });
    await session.start();
    await session.signIn();
    await session.signOut();
    expect(await session.copyTo(session['workspace'].currentId)).toBe(false);
    expect(session.mode).toBe('local');
  });
});
