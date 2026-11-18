// Ordem topológica estável (FR-21): segue fios Flow/Condition; empate por x, depois y, depois id.
import type { NodeId } from './ids.ts';
import type { Graph, GraphNode } from './model.ts';
import { sequenceEdges } from './queries.ts';

export function compareNodes(a: GraphNode, b: GraphNode): number {
  if (a.position.x !== b.position.x) return a.position.x - b.position.x;
  if (a.position.y !== b.position.y) return a.position.y - b.position.y;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export interface KahnResult {
  /** Peças em ordem topológica. */
  readonly order: readonly GraphNode[];
  /** Peças presas em ciclo ou abaixo de um ciclo (vazio num grafo válido, INV-06). */
  readonly rest: readonly GraphNode[];
}

export function kahn(graph: Graph): KahnResult {
  const edges = sequenceEdges(graph);
  const indegree = new Map<NodeId, number>(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const ready = graph.nodes.filter((node) => indegree.get(node.id) === 0);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const order: GraphNode[] = [];

  const takeNext = (): GraphNode | undefined => ready.sort(compareNodes).shift();
  for (let node = takeNext(); node !== undefined; node = takeNext()) {
    order.push(node);
    for (const edge of edges) {
      if (edge.source !== node.id) continue;
      const left = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, left);
      const target = byId.get(edge.target);
      if (left === 0 && target !== undefined) ready.push(target);
    }
  }

  const placed = new Set(order.map((node) => node.id));
  const rest = graph.nodes.filter((node) => !placed.has(node.id)).sort(compareNodes);
  return { order, rest };
}

/**
 * Ordem total e determinística das peças. Num grafo inválido (com ciclo), as peças que sobram
 * vão ao fim, também ordenadas por x, y, id.
 */
export function topologicalOrder(graph: Graph): readonly GraphNode[] {
  const { order, rest } = kahn(graph);
  return [...order, ...rest];
}
