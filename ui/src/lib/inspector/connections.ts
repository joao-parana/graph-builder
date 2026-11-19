// Ligações de uma peça para o inspetor (FR-11, FR-13, FR-14), com os rótulos do §6 (regra 8).
// Listas na ordem topológica, como no prompt exportado.
import {
  EdgeKind,
  type Graph,
  type GraphEdge,
  type GraphNode,
  judgedSources,
  type NodeId,
  returnLinks,
  topologicalOrder,
} from '@graph-builder/core';

export interface Connections {
  readonly receivesFrom: readonly GraphNode[];
  readonly sendsTo: readonly GraphNode[];
  readonly writesTo: readonly GraphNode[];
  readonly readsFrom: readonly GraphNode[];
  /** Supervisor: origens que ele julga (§3.3). */
  readonly judges: readonly GraphNode[];
  /** Memória: quem escreve e quem consulta. */
  readonly writers: readonly GraphNode[];
  readonly readers: readonly GraphNode[];
  /** Decisão: fios de saída, na ordem do destino. */
  readonly paths: readonly { readonly edge: GraphEdge; readonly target: GraphNode }[];
}

export function connectionsOf(graph: Graph, id: NodeId): Connections {
  const order = topologicalOrder(graph);
  const rank = new Map(order.map((node, index) => [node.id, index]));
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const rankOf = (nodeId: NodeId) => rank.get(nodeId) ?? Number.MAX_SAFE_INTEGER;

  const pick = (ids: readonly NodeId[]): readonly GraphNode[] =>
    [...new Set(ids)]
      .sort((a, b) => rankOf(a) - rankOf(b))
      .flatMap((nodeId) => byId.get(nodeId) ?? []);
  const from = (kinds: readonly EdgeKind[]) =>
    pick(graph.edges.filter((e) => e.target === id && kinds.includes(e.kind)).map((e) => e.source));
  const to = (kinds: readonly EdgeKind[]) =>
    pick(graph.edges.filter((e) => e.source === id && kinds.includes(e.kind)).map((e) => e.target));

  const paths = graph.edges
    .filter((edge) => edge.source === id && edge.kind === EdgeKind.Condition)
    .flatMap((edge) => {
      const target = byId.get(edge.target);
      return target === undefined ? [] : [{ edge, target }];
    })
    .sort((a, b) => rankOf(a.target.id) - rankOf(b.target.id));

  return {
    receivesFrom: from([EdgeKind.Flow, EdgeKind.Condition]),
    sendsTo: to([EdgeKind.Flow]),
    writesTo: to([EdgeKind.MemoryWrite]),
    readsFrom: from([EdgeKind.MemoryRead]),
    judges: pick(judgedSources(graph, id).map((node) => node.id)),
    writers: from([EdgeKind.MemoryWrite]),
    readers: to([EdgeKind.MemoryRead]),
    paths,
  };
}

/** Resumo do inspetor do Grafo (FR-10). */
export function summaryOf(graph: Graph): {
  readonly counts: Readonly<Record<string, number>>;
  readonly wires: number;
  readonly loops: number;
} {
  const counts: Record<string, number> = {};
  for (const node of graph.nodes) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  return { counts, wires: graph.edges.length, loops: returnLinks(graph).length };
}
