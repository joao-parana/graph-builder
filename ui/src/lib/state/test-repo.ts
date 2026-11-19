// GraphRepository em memória para os testes do estado (Workspace, Session).
import type { Graph, GraphId, GraphRepository, GraphSummary } from '@graph-builder/core';

export class MemoryRepo implements GraphRepository {
  readonly graphs = new Map<GraphId, Graph>();
  saves = 0;
  fail = false;

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
    if (this.fail) return Promise.reject(new Error('quota'));
    this.saves += 1;
    this.graphs.set(graph.id, graph);
    return Promise.resolve();
  }
  delete(id: GraphId): Promise<void> {
    this.graphs.delete(id);
    return Promise.resolve();
  }
}
