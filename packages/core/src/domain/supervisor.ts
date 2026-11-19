// Laço do Supervisor: retorno implícito para os construtores (SPEC §3.3, Q1 e Q3).
import type { NodeId } from './ids.ts';
import { EdgeKind, type Graph, type GraphNode, NodeKind } from './model.ts';
import { nodeMap } from './queries.ts';

/** Peças que podem ser construtores e mostram o ponto dourado (Q1). */
export const RETURN_ANCHOR_KINDS: readonly NodeKind[] = [NodeKind.Worker, NodeKind.Delivery];

/** Tipos de origem cujo fio Flow o Supervisor julga (Q3). */
const JUDGED_KINDS: readonly NodeKind[] = [...RETURN_ANCHOR_KINDS, NodeKind.Supervisor];

export const hasReturnAnchor = (kind: NodeKind): boolean => RETURN_ANCHOR_KINDS.includes(kind);

/** Origens dos fios Flow que o Supervisor julga (VAL-05: lista vazia = erro). */
export function judgedSources(graph: Graph, supervisorId: NodeId): readonly GraphNode[] {
  const nodes = nodeMap(graph);
  const sources: GraphNode[] = [];
  for (const edge of graph.edges) {
    if (edge.target !== supervisorId || edge.kind !== EdgeKind.Flow) continue;
    const source = nodes.get(edge.source);
    if (source && JUDGED_KINDS.includes(source.kind)) sources.push(source);
  }
  return sources;
}

/**
 * Construtores do Supervisor: destinos do "devolve para refazer". Origens Supervisor (críticos em
 * série) são resolvidas pelos construtores delas. Sem repetição, na ordem de `graph.nodes`.
 */
export function supervisorBuilders(graph: Graph, supervisorId: NodeId): readonly NodeId[] {
  const builders = new Set<NodeId>();
  const visited = new Set<NodeId>();
  const visit = (id: NodeId): void => {
    if (visited.has(id)) return; // defesa contra ciclo em grafo inválido
    visited.add(id);
    for (const source of judgedSources(graph, id)) {
      if (source.kind === NodeKind.Supervisor) visit(source.id);
      else builders.add(source.id);
    }
  };
  visit(supervisorId);
  return graph.nodes.filter((node) => builders.has(node.id)).map((node) => node.id);
}

export interface ReturnLink {
  readonly supervisorId: NodeId;
  readonly builderId: NodeId;
}

/** Todos os fios de retorno derivados, para a UI desenhar (tracejado vermelho). */
export function returnLinks(graph: Graph): readonly ReturnLink[] {
  return graph.nodes
    .filter((node) => node.kind === NodeKind.Supervisor)
    .flatMap((supervisor) =>
      supervisorBuilders(graph, supervisor.id).map((builderId) => ({
        supervisorId: supervisor.id,
        builderId,
      })),
    );
}
