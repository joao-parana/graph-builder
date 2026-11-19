// GraphRepository no IndexedDB do navegador (FR-30, FR-31, NFR-05), via idb-keyval.
import { createStore, del, get, set, type UseStore, values } from 'idb-keyval';
import type { GraphRepository, GraphSummary } from '../application/index.ts';
import type { Graph, GraphId } from '../domain/index.ts';

export const GRAPH_DB_NAME = 'graph-builder';
export const GRAPH_STORE_NAME = 'graphs';

/** Grafos guardados como objetos (clone estruturado), com o `GraphId` como chave. */
export class IndexedDbGraphRepository implements GraphRepository {
  private readonly store: UseStore;

  constructor(dbName = GRAPH_DB_NAME, storeName = GRAPH_STORE_NAME) {
    this.store = createStore(dbName, storeName);
  }

  /** Sem ordem garantida: `ListGraphs` ordena. */
  async list(): Promise<readonly GraphSummary[]> {
    const graphs = await values<Graph>(this.store);
    return graphs.map((graph) => ({
      id: graph.id,
      name: graph.name,
      nodeCount: graph.nodes.length,
      updatedAt: graph.updatedAt,
    }));
  }

  async get(id: GraphId): Promise<Graph | null> {
    return (await get<Graph>(id, this.store)) ?? null;
  }

  save(graph: Graph): Promise<void> {
    return set(graph.id, graph, this.store);
  }

  delete(id: GraphId): Promise<void> {
    return del(id, this.store);
  }
}
