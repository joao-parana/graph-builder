// LayoutEngine do botão "Arrumar" (FR-07) com @dagrejs/dagre: da esquerda para a direita.
import { Graph as DagreGraph, layout } from '@dagrejs/dagre';
import type { LayoutEngine } from '../application/index.ts';
import { type Graph, type NodeId, type Position, topologicalOrder } from '../domain/index.ts';

/** Largura da peça no mockup (`.node { width: 190px }`) e altura aproximada. */
export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 72;
const RANK_SEP = 80;
const NODE_SEP = 40;

/**
 * Posições de canto superior esquerdo, inteiras. Peças e fios entram em ordem fixa (ordem
 * topológica; fios por id), então o resultado não depende da ordem de `nodes`/`edges`.
 */
export const dagreLayoutEngine: LayoutEngine = {
  layout(graph: Graph): ReadonlyMap<NodeId, Position> {
    const dagreGraph = new DagreGraph<
      object,
      { width: number; height: number; x?: number; y?: number },
      object
    >();
    dagreGraph.setGraph({
      rankdir: 'LR',
      ranksep: RANK_SEP,
      nodesep: NODE_SEP,
      marginx: 0,
      marginy: 0,
    });
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const order = topologicalOrder(graph);
    for (const node of order) {
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    const ids = new Set(order.map((node) => node.id));
    const edges = graph.edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .sort((a, b) => (a.id < b.id ? -1 : 1)); // ids de fio são únicos
    for (const edge of edges) dagreGraph.setEdge(edge.source, edge.target);

    layout(dagreGraph);

    const positions = new Map<NodeId, Position>();
    for (const node of order) {
      const { x = 0, y = 0 } = dagreGraph.node(node.id);
      positions.set(node.id, {
        x: Math.round(x - NODE_WIDTH / 2),
        y: Math.round(y - NODE_HEIGHT / 2),
      });
    }
    return positions;
  },
};
