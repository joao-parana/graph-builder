// M8 (FR-22): itens "caminho: mensagem" de um JSON recusado pelo ImportJson.
import {
  type DomainError,
  type Graph,
  type ImportError,
  jsonGraphCodec,
} from '@graph-builder/core';
import { ptBR } from '#lib/i18n/pt-BR.ts';

export interface ImportProblem {
  readonly path: string;
  readonly message: string;
}

/** Caminho do 1º fio ou peça citado pelo invariante (`edges[4]`, `nodes[2]`), ou `$`. */
function pathOf(graph: Graph | null, error: DomainError): string {
  const edge = error.edgeIds[0];
  const edgeIndex = edge === undefined ? -1 : (graph?.edges.findIndex((e) => e.id === edge) ?? -1);
  if (edgeIndex >= 0) return `edges[${String(edgeIndex)}]`;
  const node = error.nodeIds[0];
  const nodeIndex = node === undefined ? -1 : (graph?.nodes.findIndex((n) => n.id === node) ?? -1);
  if (nodeIndex >= 0) return `nodes[${String(nodeIndex)}]`;
  return error.code === 'INV-09' ? 'name' : '$';
}

export function importProblems(text: string, error: ImportError): readonly ImportProblem[] {
  if (error.kind === 'codec') return error.issues;
  const decoded = jsonGraphCodec.decode(text);
  const graph = decoded.ok ? decoded.value : null;
  return error.errors.map((item) => ({
    path: pathOf(graph, item),
    message: `${ptBR.errors[item.code]} (${item.code}).`,
  }));
}
