// Portas da aplicação (SPEC §7.1). Implementadas na infraestrutura (L03) e nos testes.
import type { Graph, GraphId, NodeId, Position, Result } from '../domain/index.ts';

/** Item da lista "Meus grafos" (FR-31). */
export interface GraphSummary {
  readonly id: GraphId;
  readonly name: string;
  readonly nodeCount: number;
  readonly updatedAt: string;
}

export interface GraphRepository {
  list(): Promise<readonly GraphSummary[]>;
  get(id: GraphId): Promise<Graph | null>;
  save(graph: Graph): Promise<void>;
  delete(id: GraphId): Promise<void>;
}

export interface LayoutEngine {
  layout(graph: Graph): ReadonlyMap<NodeId, Position>;
}

export interface Clock {
  /** ISO-8601. */
  now(): string;
}

export interface IdGenerator {
  next(): string;
}

/** Template do SPEC §6. */
export interface PromptRenderer {
  render(graph: Graph): string;
}

/** Problema de leitura do JSON, com o caminho do campo (FR-22). */
export interface CodecIssue {
  readonly path: string;
  readonly message: string;
}

export interface GraphCodec {
  encode(graph: Graph): string;
  decode(text: string): Result<Graph, readonly CodecIssue[]>;
}

/** Dependências dos comandos de edição. */
export interface EditContext {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

// v2 (ADR-0004): conta e nuvem.

/** Onde ficam os grafos abertos e listados (SPEC §2). */
export type StorageMode = 'local' | 'cloud';

/** Usuário convidado, identificado pelo login do GitHub (FR-50). */
export interface Account {
  readonly id: string;
  readonly login: string;
  readonly avatarUrl: string | null;
}

/** FR-51: sem convite, login cancelado no GitHub ou falha de rede/servidor. */
export type AuthError = 'NOT_INVITED' | 'CANCELLED' | 'NETWORK';

export interface AuthGateway {
  /** Sessão atual, ou `null`. */
  account(): Promise<Account | null>;
  /** Vai ao GitHub (OAuth com PKCE); volta para a raiz do app. */
  signIn(): Promise<void>;
  /** Na volta do GitHub: a conta ou o motivo da recusa; `null` se a página não é volta de login. */
  completeSignIn(): Promise<Result<Account, AuthError> | null>;
  signOut(): Promise<void>;
  /** Mudanças de sessão (entrar, sair, expirar — FR-56). Devolve a função que cancela. */
  onChange(listener: (account: Account | null) => void): () => void;
}
