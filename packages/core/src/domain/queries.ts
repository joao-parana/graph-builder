// Consultas de leitura sobre o Graph, usadas pelas regras do domínio.
import { isSequenceKind } from './edge-kind.ts';
import type { NodeId } from './ids.ts';
import type { Graph, GraphEdge, GraphNode } from './model.ts';

export const nodeMap = (graph: Graph): ReadonlyMap<NodeId, GraphNode> =>
  new Map(graph.nodes.map((node) => [node.id, node]));

export const sequenceEdges = (graph: Graph): readonly GraphEdge[] =>
  graph.edges.filter((edge) => isSequenceKind(edge.kind));

/** Destinos de fios de sequência, por origem. */
export function successors(edges: readonly GraphEdge[]): ReadonlyMap<NodeId, readonly NodeId[]> {
  const map = new Map<NodeId, NodeId[]>();
  for (const edge of edges) {
    const list = map.get(edge.source);
    if (list) list.push(edge.target);
    else map.set(edge.source, [edge.target]);
  }
  return map;
}

/** Peças alcançáveis a partir de `starts` (inclusive) seguindo `next`. */
export function reachable(
  starts: Iterable<NodeId>,
  next: ReadonlyMap<NodeId, readonly NodeId[]>,
): ReadonlySet<NodeId> {
  const seen = new Set<NodeId>(starts);
  const stack = [...seen];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    for (const target of next.get(id) ?? []) {
      if (!seen.has(target)) {
        seen.add(target);
        stack.push(target);
      }
    }
  }
  return seen;
}
