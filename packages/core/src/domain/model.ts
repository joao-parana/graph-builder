// Modelo de domínio (SPEC §3.1). Imutável: casos de uso devolvem um Graph novo.
import type { EdgeId, GraphId, NodeId } from './ids.ts';

export enum NodeKind {
  Input = 'input',
  Worker = 'worker',
  Supervisor = 'supervisor',
  Delivery = 'delivery',
  Decision = 'decision',
  Memory = 'memory',
}

export enum EdgeKind {
  /** Artefato segue adiante. */
  Flow = 'flow',
  /** Sai de uma Decisão; exige `condition`. */
  Condition = 'condition',
  /** Peça → Memória. */
  MemoryWrite = 'memory-write',
  /** Memória → peça. */
  MemoryRead = 'memory-read',
}

/** Presets da barra (FR-12, Q6). Textos em `bar-presets.ts`. */
export type BarPresetId = 'wow' | 'no-errors' | 'concrete-evidence' | 'explicit-audience';

export type OnExhausted = 'deliver-best-with-caveats' | 'fail';

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface BaseNode {
  readonly id: NodeId;
  readonly kind: NodeKind;
  /** Auto-gerado ("Trabalhador 4"), editável, 1..80 chars (INV-07). */
  readonly name: string;
  /** Texto livre; no Supervisor é "a barra". */
  readonly instructions: string;
  readonly position: Position;
}

/** Peças sem campos próprios. Separa o `kind` para a união ser discriminada. */
export interface PlainNode extends BaseNode {
  readonly kind: NodeKind.Input | NodeKind.Worker | NodeKind.Delivery | NodeKind.Decision;
}

export interface SupervisorNode extends BaseNode {
  readonly kind: NodeKind.Supervisor;
  readonly presets: readonly BarPresetId[];
  /** Inteiro em 1..10 (INV-08). */
  readonly maxRounds: number;
  readonly onExhausted: OnExhausted;
}

export interface MemoryNode extends BaseNode {
  readonly kind: NodeKind.Memory;
  /** Nomes de relações permitidas, ex.: ["depende_de", "contradiz"]. */
  readonly relations: readonly string[];
}

export type GraphNode = PlainNode | SupervisorNode | MemoryNode;

export interface GraphEdge {
  readonly id: EdgeId;
  readonly source: NodeId;
  readonly target: NodeId;
  /** Derivado dos tipos das pontas (§3.2), nunca escolhido pelo usuário. */
  readonly kind: EdgeKind;
  /** Obrigatório para exportar se kind = Condition (VAL-03). */
  readonly condition?: string;
}

export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export const SCHEMA_VERSION = 1;

export interface Graph {
  readonly id: GraphId;
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly name: string;
  readonly objective: string;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly viewport: Viewport;
  /** ISO-8601. */
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const NAME_MAX_LENGTH = 80;
export const MAX_ROUNDS_MIN = 1;
export const MAX_ROUNDS_MAX = 10;

/** Padrões do Supervisor (Q2). */
export const SUPERVISOR_DEFAULTS = {
  maxRounds: 3,
  onExhausted: 'deliver-best-with-caveats',
} as const satisfies { maxRounds: number; onExhausted: OnExhausted };
