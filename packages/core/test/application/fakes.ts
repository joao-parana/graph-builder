// Implementações de teste das portas (SPEC §7.1).
import type {
  Clock,
  EditContext,
  GraphCodec,
  GraphRepository,
  GraphSummary,
  IdGenerator,
  LayoutEngine,
  PromptRenderer,
} from '../../src/application/index.ts';
import {
  err,
  type Graph,
  type GraphId,
  type NodeId,
  ok,
  type Position,
  topologicalOrder,
} from '../../src/domain/index.ts';

/** Relógio que avança 1 s a cada leitura, a partir de 2026-11-18T00:00:00Z. */
export function steppingClock(): Clock {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 10, 18, 0, 0, tick++)).toISOString(),
  };
}

export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return { next: () => `${prefix}-${String(++n)}` };
}

export const context = (): EditContext => ({ clock: steppingClock(), ids: sequentialIds() });

export class MemoryRepository implements GraphRepository {
  readonly graphs = new Map<GraphId, Graph>();

  list(): Promise<readonly GraphSummary[]> {
    return Promise.resolve(
      [...this.graphs.values()].map((g) => ({
        id: g.id,
        name: g.name,
        nodeCount: g.nodes.length,
        updatedAt: g.updatedAt,
      })),
    );
  }

  get(id: GraphId): Promise<Graph | null> {
    return Promise.resolve(this.graphs.get(id) ?? null);
  }

  save(graph: Graph): Promise<void> {
    this.graphs.set(graph.id, graph);
    return Promise.resolve();
  }

  delete(id: GraphId): Promise<void> {
    this.graphs.delete(id);
    return Promise.resolve();
  }
}

/** Renderer mínimo: nomes na ordem topológica. */
export const namesRenderer: PromptRenderer = {
  render: (graph) =>
    topologicalOrder(graph)
      .map((n) => n.name)
      .join(' > '),
};

/** Codec mínimo: JSON sem schema (o schema real é da L03). */
export const jsonCodec: GraphCodec = {
  encode: (graph) => JSON.stringify(graph),
  decode: (text) => {
    try {
      return ok(JSON.parse(text) as Graph);
    } catch {
      return err([{ path: '$', message: 'JSON inválido' }]);
    }
  },
};

/** Layout que põe as peças em fila, 200 px entre elas, na ordem topológica. */
export const rowLayout: LayoutEngine = {
  layout: (graph) =>
    new Map<NodeId, Position>(topologicalOrder(graph).map((n, i) => [n.id, { x: i * 200, y: 0 }])),
};
