// Regras "Antes de exportar" (SPEC §3.5). Não bloqueiam a edição; erros bloqueiam a exportação.
// O domínio devolve só códigos e parâmetros; os textos ficam no i18n da UI (NFR-06).
import { isSequenceKind } from './edge-kind.ts';
import type { EdgeId, NodeId } from './ids.ts';
import { EdgeKind, type Graph, type GraphNode, NodeKind } from './model.ts';
import { reachable, sequenceEdges, successors } from './queries.ts';
import { judgedSources } from './supervisor.ts';

export type ValidationRule =
  | 'VAL-01'
  | 'VAL-02'
  | 'VAL-03'
  | 'VAL-04'
  | 'VAL-05'
  | 'VAL-06'
  | 'VAL-07'
  | 'VAL-08'
  | 'VAL-09'
  | 'VAL-10';

export type ValidationLevel = 'error' | 'warning';

export const RULE_LEVEL: Readonly<Record<ValidationRule, ValidationLevel>> = {
  'VAL-01': 'error',
  'VAL-02': 'warning',
  'VAL-03': 'error',
  'VAL-04': 'warning',
  'VAL-05': 'error',
  'VAL-06': 'warning',
  'VAL-07': 'error',
  'VAL-08': 'warning',
  'VAL-09': 'warning',
  'VAL-10': 'error',
};

export interface ValidationIssue {
  readonly rule: ValidationRule;
  readonly level: ValidationLevel;
  /** Peças envolvidas; a primeira é a que a UI seleciona ao clicar no item (FR-20). */
  readonly nodeIds: readonly NodeId[];
  readonly edgeIds: readonly EdgeId[];
  /**
   * Valores para a mensagem. `name`: nome da peça (VAL-02..06, 08, 09).
   * `missing` (VAL-09): `write` = ninguém escreve; `read` = ninguém consulta.
   */
  readonly params: Readonly<Record<string, string>>;
}

const issue = (
  rule: ValidationRule,
  refs: {
    nodeIds?: readonly NodeId[];
    edgeIds?: readonly EdgeId[];
    params?: Readonly<Record<string, string>>;
  } = {},
): ValidationIssue => ({
  rule,
  level: RULE_LEVEL[rule],
  nodeIds: refs.nodeIds ?? [],
  edgeIds: refs.edgeIds ?? [],
  params: refs.params ?? {},
});

const isBlank = (text: string | undefined): boolean => (text ?? '').trim().length === 0;

const about = (node: GraphNode): { nodeIds: readonly NodeId[]; params: { name: string } } => ({
  nodeIds: [node.id],
  params: { name: node.name },
});

/** VAL-10: peças com fios de sequência que não descendem do início (ver SPEC §3.5). */
function unreachableNodes(graph: Graph): readonly NodeId[] {
  const edges = sequenceEdges(graph);
  const linked = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const targets = new Set(edges.map((edge) => edge.target));
  const input = graph.nodes.find((node) => node.kind === NodeKind.Input);
  const starts =
    input === undefined
      ? graph.nodes
          .filter((node) => node.kind !== NodeKind.Memory && !targets.has(node.id))
          .map((node) => node.id)
      : [input.id];
  const seen = reachable(starts, successors(edges));
  return graph.nodes
    .filter((node) => node.kind !== NodeKind.Memory && linked.has(node.id) && !seen.has(node.id))
    .map((node) => node.id);
}

/** Valida o grafo. Ordem: erros antes de alertas, depois ID da regra, depois ordem das peças. */
export function validateGraph(graph: Graph): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const outgoing = (id: NodeId) => graph.edges.filter((edge) => edge.source === id);
  const incoming = (id: NodeId) => graph.edges.filter((edge) => edge.target === id);

  if (isBlank(graph.objective)) issues.push(issue('VAL-01'));

  for (const node of graph.nodes) {
    if (isBlank(node.instructions)) issues.push(issue('VAL-02', about(node)));

    if (node.kind === NodeKind.Decision) {
      const paths = outgoing(node.id).filter((edge) => edge.kind === EdgeKind.Condition);
      const blank = paths.filter((edge) => isBlank(edge.condition));
      if (blank.length > 0) {
        issues.push(issue('VAL-03', { ...about(node), edgeIds: blank.map((edge) => edge.id) }));
      }
      if (paths.length < 2) issues.push(issue('VAL-04', about(node)));
    }

    if (node.kind === NodeKind.Supervisor) {
      if (judgedSources(graph, node.id).length === 0) issues.push(issue('VAL-05', about(node)));
      if (!outgoing(node.id).some((edge) => isSequenceKind(edge.kind))) {
        issues.push(issue('VAL-06', about(node)));
      }
    }

    if (outgoing(node.id).length === 0 && incoming(node.id).length === 0) {
      issues.push(issue('VAL-08', about(node)));
    }

    if (node.kind === NodeKind.Memory) {
      if (!incoming(node.id).some((edge) => edge.kind === EdgeKind.MemoryWrite)) {
        issues.push(
          issue('VAL-09', { ...about(node), params: { name: node.name, missing: 'write' } }),
        );
      }
      if (!outgoing(node.id).some((edge) => edge.kind === EdgeKind.MemoryRead)) {
        issues.push(
          issue('VAL-09', { ...about(node), params: { name: node.name, missing: 'read' } }),
        );
      }
    }
  }

  if (!graph.nodes.some((node) => node.kind === NodeKind.Delivery)) issues.push(issue('VAL-07'));

  const unreachable = unreachableNodes(graph);
  if (unreachable.length > 0) issues.push(issue('VAL-10', { nodeIds: unreachable }));

  const position = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const firstNode = (item: ValidationIssue): number =>
    item.nodeIds[0] === undefined ? -1 : (position.get(item.nodeIds[0]) ?? -1);
  const levelRank = (item: ValidationIssue): number => (item.level === 'error' ? 0 : 1);
  return issues.sort(
    (a, b) =>
      levelRank(a) - levelRank(b) || a.rule.localeCompare(b.rule) || firstNode(a) - firstNode(b),
  );
}

/** Há erro que bloqueia a exportação? (FR-21) */
export const hasBlockingErrors = (issues: readonly ValidationIssue[]): boolean =>
  issues.some((item) => item.level === 'error');
