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
