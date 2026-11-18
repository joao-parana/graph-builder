// "Meus grafos" (FR-30, FR-31): casos de uso sobre o GraphRepository.
import type { Graph, GraphId } from '../domain/index.ts';
import type { GraphRepository, GraphSummary } from './ports.ts';

/** ListGraphs: mais recente primeiro; empate pelo nome. */
export async function listGraphs(repo: GraphRepository): Promise<readonly GraphSummary[]> {
  const items = await repo.list();
  return [...items].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, 'pt-BR'),
  );
}

/** OpenGraph: `null` se o grafo não existe mais. */
export const openGraph = (repo: GraphRepository, id: GraphId): Promise<Graph | null> =>
  repo.get(id);

/** SaveGraph (autosave, FR-30). */
export const saveGraph = (repo: GraphRepository, graph: Graph): Promise<void> => repo.save(graph);

/** DeleteGraph (FR-31; a confirmação é da UI). */
export const deleteGraph = (repo: GraphRepository, id: GraphId): Promise<void> => repo.delete(id);
