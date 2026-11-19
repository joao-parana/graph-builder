// Graph ⇄ Svelte Flow (ADR-0003, item 3). Só leitura: o canvas desenha o que o core devolve.
import { type Edge, MarkerType, type Node } from '@xyflow/svelte';
import {
  canConnect,
  EdgeKind,
  type EdgeId,
  type Graph,
  hasReturnAnchor,
  NodeKind,
  nodeId,
  type NodeId,
  returnLinks,
} from '@graph-builder/core';

/** Alças das peças. `return-*` são âncoras do retorno implícito (§3.3), sem ligação manual. */
export const HANDLE = {
  in: 'in',
  out: 'out',
  returnIn: 'return-in',
  returnOut: 'return-out',
} as const;

export const PIECE_TYPE = 'piece';
export const RETURN_EDGE_PREFIX = 'return:';

export interface PieceData extends Record<string, unknown> {
  readonly kind: NodeKind;
  readonly name: string;
  readonly instructions: string;
  /** Memória: relações, mostradas no lugar das instruções. */
  readonly relations: readonly string[];
  /** Ponto dourado (§3.3): Trabalhador e Entrega. */
  readonly returnAnchor: boolean;
}

export type PieceNode = Node<PieceData, typeof PIECE_TYPE>;

export type EdgeStyle = 'flow' | 'memory' | 'return';

export interface WireData extends Record<string, unknown> {
  readonly style: EdgeStyle;
}

export type Wire = Edge<WireData>;

export function toFlowNodes(graph: Graph, selected: readonly NodeId[]): PieceNode[] {
  const chosen = new Set<string>(selected);
  return graph.nodes.map((node) => ({
    id: node.id,
    type: PIECE_TYPE,
    position: { x: node.position.x, y: node.position.y },
    selected: chosen.has(node.id),
    class: `piece-${node.kind}`,
    data: {
      kind: node.kind,
      name: node.name,
      instructions: node.instructions,
      relations: node.kind === NodeKind.Memory ? node.relations : [],
      returnAnchor: hasReturnAnchor(node.kind),
    },
  }));
}

const isMemoryKind = (kind: EdgeKind): boolean =>
  kind === EdgeKind.MemoryWrite || kind === EdgeKind.MemoryRead;

/** Fios do modelo + retornos derivados (FR-09). Nenhum é selecionável pelo Svelte Flow. */
export function toFlowEdges(graph: Graph, armed: EdgeId | null): Wire[] {
  const wires: Wire[] = graph.edges.map((edge) => {
    const style: EdgeStyle = isMemoryKind(edge.kind) ? 'memory' : 'flow';
    const armedClass = edge.id === armed ? ' armed' : '';
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: HANDLE.out,
      targetHandle: HANDLE.in,
      selectable: false,
      class: `wire wire-${style}${armedClass}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: style === 'memory' ? '#7D8794' : '#3B342A',
      },
      data: { style },
      ...(edge.kind === EdgeKind.Condition && edge.condition !== undefined && edge.condition !== ''
        ? { label: edge.condition }
        : {}),
    };
  });
  const returns: Wire[] = returnLinks(graph).map(({ supervisorId, builderId }) => ({
    id: `${RETURN_EDGE_PREFIX}${supervisorId}->${builderId}`,
    source: supervisorId,
    target: builderId,
    sourceHandle: HANDLE.returnOut,
    targetHandle: HANDLE.returnIn,
    selectable: false,
    focusable: false,
    class: 'wire wire-return',
    data: { style: 'return' },
  }));
  return [...wires, ...returns];
}

/** FR-02: só da saída de uma peça até a entrada de outra, e só se o domínio aceita. */
export function isValidWire(
  graph: Graph,
  connection: { source: string; target: string; targetHandle?: string | null },
): boolean {
  if ((connection.targetHandle ?? HANDLE.in) !== HANDLE.in) return false;
  return canConnect(graph, nodeId(connection.source), nodeId(connection.target)).ok;
}

export const isReturnWire = (id: string): boolean => id.startsWith(RETURN_EDGE_PREFIX);
