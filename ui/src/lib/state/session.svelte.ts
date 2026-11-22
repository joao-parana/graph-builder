// Conta e modo de armazenamento (v2: FR-50..56, Q8). Decide o repositório do Workspace pelo modo,
// faz login e logout pelo AuthGateway e copia grafos entre os modos.
import type {
  Account,
  AuthGateway,
  GraphId,
  GraphRepository,
  StorageMode,
} from '@graph-builder/core';
import { ptBR } from '#lib/i18n/pt-BR.ts';
import { browserStore, type KeyValueStore, readMode, writeMode } from './mode-preference.ts';
import type { DescribeFailure, Workspace } from './workspace.svelte.ts';

/** Só existe quando o build tem as variáveis do Supabase (ADR-0004, item 9). */
export interface CloudServices {
  readonly gateway: AuthGateway;
  readonly repo: GraphRepository;
}

export interface SessionDeps {
  readonly workspace: Workspace;
  readonly local: GraphRepository;
  /** Carrega os adaptadores da nuvem (`import()` no app); `null` sem Supabase no build. */
  readonly cloud: (() => Promise<CloudServices>) | null;
  readonly notify: (message: string) => void;
  readonly store?: KeyValueStore | null;
  readonly online?: () => boolean;
}

/** `CloudStorageError` traz `reason`; outros erros, a mensagem. */
const reasonOf = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'reason' in error) {
    const { reason } = error;
    if (typeof reason === 'string') return reason;
  }
  return error instanceof Error ? error.message : String(error);
};

export class Session {
  private readonly workspace: Workspace;
  private readonly local: GraphRepository;
  private readonly loadCloud: (() => Promise<CloudServices>) | null;
  /** Fica pronto no `start`; até lá (ou se o carregamento falhar), só o modo local. */
  private cloud: CloudServices | null = null;
  private readonly notify: (message: string) => void;
  private readonly store: KeyValueStore | null;
  private readonly online: () => boolean;
  private signingOut = false;
  private unsubscribe: (() => void) | null = null;

  account: Account | null = $state.raw(null);
  mode: StorageMode = $state('local');
  /** "Entrando…": troca do `?code=` na volta ou ida ao GitHub (FR-50). */
  signingIn = $state(false);
  /** O build tem a nuvem e os adaptadores carregaram (ou ainda vão carregar). */
  cloudAvailable = $state(false);
  /** FR-51: aviso da volta do login; fica no modal até o usuário fechar (`dismissNotice`). */
  notice: string | null = $state(null);

  constructor(deps: SessionDeps) {
    this.workspace = deps.workspace;
    this.local = deps.local;
    this.loadCloud = deps.cloud;
    this.cloudAvailable = deps.cloud !== null;
    this.notify = deps.notify;
    this.store = deps.store === undefined ? browserStore() : deps.store;
    this.online = deps.online ?? (() => navigator.onLine);
  }

  /** FR-55: sem conexão, texto próprio; senão, o motivo do Supabase. */
  readonly describeCloudFailure: DescribeFailure = (error) =>
    this.online() ? ptBR.cloud.saveFailed(reasonOf(error)) : ptBR.cloud.offline;

  /** Ao abrir o app: volta do login (FR-50, FR-51), sessão guardada e modo lembrado (Q8). */
  async start(): Promise<void> {
    const cloud = this.loadCloud === null ? null : await this.loadCloud().catch(() => null);
    this.cloud = cloud;
    this.cloudAvailable = cloud !== null;
    if (cloud === null) {
      await this.workspace.start();
      return;
    }
    let mode: StorageMode;
    this.signingIn = true;
    const returned = await cloud.gateway.completeSignIn().catch(() => ({
      ok: false as const,
      error: 'NETWORK' as const,
    }));
    this.signingIn = false;
    if (returned === null) {
      this.account = await cloud.gateway.account().catch(() => null);
      mode = readMode(this.store, this.account !== null);
    } else if (returned.ok) {
      this.account = returned.value;
      mode = 'cloud';
      writeMode(this.store, mode);
    } else {
      if (returned.error === 'NOT_INVITED') this.notice = ptBR.cloud.notInvited;
      if (returned.error === 'NETWORK') this.notice = ptBR.cloud.signInFailed;
      mode = 'local';
    }
    if (mode === 'cloud') await this.enter('cloud');
    else await this.workspace.start();
    this.unsubscribe = cloud.gateway.onChange((account) => {
      this.changed(account);
    });
  }

  dismissNotice(): void {
    this.notice = null;
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** FR-56: a sessão caiu sem "Sair" (não renovou). */
  private changed(account: Account | null): void {
    if (account !== null) {
      this.account = account;
      return;
    }
    if (this.account === null || this.signingOut) return;
    this.account = null;
    if (this.mode === 'cloud') this.workspace.status = 'error';
    this.notify(ptBR.cloud.expired);
  }

  /** FR-50, FR-56: grava o pendente; no modo nuvem sem salvar, guarda o grafo neste navegador. */
  async signIn(): Promise<void> {
    const cloud = this.cloud;
    if (cloud === null || this.signingIn) return;
    this.signingIn = true;
    await this.workspace.flush();
    if (this.mode === 'cloud' && this.workspace.status === 'error') {
      await this.workspace.keepIn(this.local);
      this.notify(ptBR.cloud.keptLocally);
    }
    try {
      await cloud.gateway.signIn(); // o navegador sai para o GitHub
    } catch {
      this.signingIn = false;
      this.notify(ptBR.cloud.signInFailed);
    }
  }

  /** FR-52: grava o pendente, encerra a sessão e volta ao modo local. */
  async signOut(): Promise<void> {
    const cloud = this.cloud;
    if (cloud === null) return;
    await this.workspace.flush();
    this.signingOut = true;
    try {
      await cloud.gateway.signOut();
    } catch {
      // Sem rede, o supabase-js já apagou a sessão local: o app sai do mesmo jeito.
    } finally {
      this.signingOut = false;
    }
    this.account = null;
    writeMode(this.store, 'local');
    await this.enter('local');
  }

  /** FR-53: "Na nuvem" só com sessão. */
  async switchMode(mode: StorageMode): Promise<void> {
    if (mode === this.mode) return;
    if (mode === 'cloud' && (this.cloud === null || this.account === null)) return;
    if (await this.enter(mode)) writeMode(this.store, mode);
  }

  /** Abre o modo; se a nuvem falhar, avisa e fica no local. */
  private async enter(mode: StorageMode): Promise<boolean> {
    const cloud = this.cloud;
    if (mode === 'local' || cloud === null) {
      await this.workspace.use(this.local);
      this.mode = 'local';
      return mode === 'local';
    }
    try {
      await this.workspace.use(cloud.repo, this.describeCloudFailure);
      this.mode = 'cloud';
      return true;
    } catch (error) {
      this.notify(this.describeCloudFailure(error));
      await this.workspace.use(this.local);
      this.mode = 'local';
      return false;
    }
  }

  /** O outro modo, se a cópia (FR-54) estiver disponível agora. */
  get copyTarget(): StorageMode | null {
    if (this.cloud === null || this.account === null) return null;
    return this.mode === 'local' ? 'cloud' : 'local';
  }

  /** FR-54: cópia com id novo para o outro modo; o grafo aberto não muda. */
  async copyTo(id: GraphId): Promise<boolean> {
    const target = this.copyTarget;
    if (target === null || this.cloud === null) return false;
    try {
      const copy = await this.workspace.copyTo(
        id,
        target === 'cloud' ? this.cloud.repo : this.local,
      );
      if (copy === null) return false;
      this.notify(ptBR.cloud.copied[target]);
      return true;
    } catch (error) {
      this.notify(this.describeCloudFailure(error));
      return false;
    }
  }
}
