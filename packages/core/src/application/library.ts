// "Meus grafos" (FR-30, FR-31): casos de uso sobre o GraphRepository.
import {
  type DomainError,
  type Graph,
  type GraphId,
  graphId,
  NAME_MAX_LENGTH,
  type Result,
} from '../domain/index.ts';
import { updateGraph } from './graph-commands.ts';
import type { EditContext, GraphRepository, GraphSummary } from './ports.ts';

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

const COPY_SUFFIX = ' (cópia)';
const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

/** Corta em caracteres percebidos (grafemas), como o INV-09 conta. */
function cut(text: string, max: number): string {
  const parts = [...segmenter.segment(text)].map((part) => part.segment);
  return parts.length <= max ? text : parts.slice(0, max).join('').trimEnd();
}

/** DuplicateGraph (FR-31): id novo, nome "{nome} (cópia)" dentro dos 80 caracteres. */
export function duplicateGraph(ctx: EditContext, graph: Graph): Graph {
  const now = ctx.clock.now();
  const base = cut(graph.name, NAME_MAX_LENGTH - [...segmenter.segment(COPY_SUFFIX)].length);
  return {
    ...graph,
    id: graphId(ctx.ids.next()),
    name: `${base}${COPY_SUFFIX}`,
    createdAt: now,
    updatedAt: now,
  };
}

/** RenameGraph (FR-31): grafo salvo que não está aberto. `null` se ele não existe mais. */
export async function renameGraph(
  ctx: EditContext,
  repo: GraphRepository,
  id: GraphId,
  name: string,
): Promise<Result<Graph, DomainError> | null> {
  const graph = await repo.get(id);
  if (graph === null) return null;
  const result = updateGraph(ctx, graph, { name });
  if (result.ok && result.value !== graph) await repo.save(result.value);
  return result;
}

/**
 * CopyGraph (FR-54): copia um grafo de um modo para o outro. A cópia ganha `GraphId` novo e
 * `updatedAt = now` (como o `ImportJson`); o original não muda. `null` se ele não existe mais.
 */
export async function copyGraph(
  ctx: EditContext,
  from: GraphRepository,
  to: GraphRepository,
  id: GraphId,
): Promise<Graph | null> {
  const graph = await from.get(id);
  if (graph === null) return null;
  const copy: Graph = { ...graph, id: graphId(ctx.ids.next()), updatedAt: ctx.clock.now() };
  await to.save(copy);
  return copy;
}
