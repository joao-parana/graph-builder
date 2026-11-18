// Rótulos pt-BR que viram dados (nomes automáticos e prompt exportado). Glossário: SPEC §2.
import type { Graph } from './model.ts';
import { NodeKind } from './model.ts';

export const NODE_KIND_LABEL: Readonly<Record<NodeKind, string>> = {
  [NodeKind.Input]: 'Entrada',
  [NodeKind.Worker]: 'Trabalhador',
  [NodeKind.Supervisor]: 'Supervisor',
  [NodeKind.Delivery]: 'Entrega',
  [NodeKind.Decision]: 'Decisão',
  [NodeKind.Memory]: 'Memória',
};

export const DEFAULT_GRAPH_NAME = 'Meu grafo';

/** FR-01: `"{Tipo} {n}"`, com `n` = menor inteiro ≥ 1 ainda não usado nesse padrão. */
export function nextNodeName(graph: Graph, kind: NodeKind): string {
  const label = NODE_KIND_LABEL[kind];
  const pattern = new RegExp(`^${label} (\\d+)$`, 'iu');
  const used = new Set<number>();
  for (const node of graph.nodes) {
    const digits = pattern.exec(node.name.trim())?.[1];
    if (digits !== undefined) used.add(Number(digits));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${label} ${String(n)}`;
}
