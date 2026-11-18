// Invariantes (SPEC §3.4). Comandos que as violariam são rejeitados com DomainError.
import { deriveEdgeKind, isSequenceKind } from './edge-kind.ts';
import { type DomainError, domainError, type NameProblem } from './errors.ts';
import type { NodeId } from './ids.ts';
import {
  type EdgeKind,
  type Graph,
  MAX_ROUNDS_MAX,
  MAX_ROUNDS_MIN,
  NAME_MAX_LENGTH,
  NodeKind,
} from './model.ts';
import { nodeMap, reachable, sequenceEdges, successors } from './queries.ts';
import { type Result, err, ok } from './result.ts';
import { kahn } from './topo-sort.ts';

/** Chave de comparação de nomes: sem espaços nas pontas e sem diferença de caixa (INV-07). */
export const nameKey = (name: string): string => name.trim().toLocaleLowerCase('pt-BR');

/** Caracteres percebidos pelo usuário (grafemas), não unidades UTF-16. */
const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
const graphemeCount = (text: string): number => [...segmenter.segment(text)].length;

/** INV-07 sem a unicidade: nome não vazio e com até 80 caracteres. */
export function nameShapeProblem(name: string): NameProblem | undefined {
  if (name.trim().length === 0) return 'empty';
  if (graphemeCount(name) > NAME_MAX_LENGTH) return 'too-long';
  return undefined;
}

/** INV-07 completo para um nome novo; `selfId` é a peça que está sendo renomeada. */
export function checkNodeName(
  graph: Graph,
  name: string,
  selfId?: NodeId,
): Result<void, DomainError> {
  const shape = nameShapeProblem(name);
  const ids = selfId === undefined ? [] : [selfId];
  if (shape !== undefined) return err(domainError('INV-07', { nodeIds: ids, reason: shape }));
  const key = nameKey(name);
  const clash = graph.nodes.find((node) => node.id !== selfId && nameKey(node.name) === key);
  if (clash !== undefined) {
    return err(domainError('INV-07', { nodeIds: [...ids, clash.id], reason: 'duplicate' }));
  }
  return ok(undefined);
}

/** INV-08. */
export const isValidMaxRounds = (value: number): boolean =>
  Number.isInteger(value) && value >= MAX_ROUNDS_MIN && value <= MAX_ROUNDS_MAX;

/** INV-01: só uma Entrada por grafo (FR-01). */
export function canAddNode(graph: Graph, kind: NodeKind): Result<void, DomainError> {
  if (kind !== NodeKind.Input) return ok(undefined);
  const inputs = graph.nodes.filter((node) => node.kind === NodeKind.Input);
  return inputs.length === 0
    ? ok(undefined)
    : err(domainError('INV-01', { nodeIds: inputs.map((node) => node.id) }));
}

/**
 * Testa um fio novo `source → target` (INV-02..06) e devolve o tipo derivado (§3.2).
 * Ordem das checagens: existência, INV-03, INV-02, INV-05, INV-04, INV-06.
 */
export function canConnect(
  graph: Graph,
  sourceId: NodeId,
  targetId: NodeId,
): Result<EdgeKind, DomainError> {
  const nodes = nodeMap(graph);
  const source = nodes.get(sourceId);
  const target = nodes.get(targetId);
  const pair = { nodeIds: [sourceId, targetId] };
  if (source === undefined || target === undefined) return err(domainError('NODE_NOT_FOUND', pair));
  if (sourceId === targetId) return err(domainError('INV-03', { nodeIds: [sourceId] }));
  if (target.kind === NodeKind.Input) return err(domainError('INV-02', pair));
  const kind = deriveEdgeKind(source.kind, target.kind);
  if (kind === undefined) return err(domainError('INV-05', pair));
  const duplicate = graph.edges.find((e) => e.source === sourceId && e.target === targetId);
  if (duplicate !== undefined) {
    return err(domainError('INV-04', { ...pair, edgeIds: [duplicate.id] }));
  }
  if (isSequenceKind(kind)) {
    // O fio fecha um ciclo se o destino já alcança a origem.
    const fromTarget = reachable([targetId], successors(sequenceEdges(graph)));
    if (fromTarget.has(sourceId)) return err(domainError('INV-06', pair));
  }
  return ok(kind);
}

/** Peças em ciclo de fios Flow/Condition (tira as que só estão abaixo ou acima dele). */
function cycleNodes(graph: Graph): readonly NodeId[] {
  const stuck = new Set(kahn(graph).rest.map((node) => node.id));
  if (stuck.size === 0) return [];
  const edges = sequenceEdges(graph).filter((e) => stuck.has(e.source) && stuck.has(e.target));
  // Num ciclo toda peça tem saída para outra peça presa; poda as que não têm.
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of stuck) {
      if (!edges.some((e) => e.source === id && stuck.has(e.target))) {
        stuck.delete(id);
        changed = true;
      }
    }
  }
  return graph.nodes.filter((node) => stuck.has(node.id)).map((node) => node.id);
}

/**
 * Confere o grafo inteiro (ex.: depois de importar um JSON). Lista vazia = grafo válido.
 * Cada fio é conferido isoladamente; INV-06 é conferido no grafo todo.
 */
export function checkGraph(graph: Graph): readonly DomainError[] {
  const errors: DomainError[] = [];
  const nodes = nodeMap(graph);

  const inputs = graph.nodes.filter((node) => node.kind === NodeKind.Input);
  if (inputs.length > 1) errors.push(domainError('INV-01', { nodeIds: inputs.map((n) => n.id) }));

  const pairs = new Set<string>();
  for (const edge of graph.edges) {
    const refs = { nodeIds: [edge.source, edge.target], edgeIds: [edge.id] };
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (source === undefined || target === undefined) {
      errors.push(domainError('NODE_NOT_FOUND', refs));
      continue;
    }
    if (edge.source === edge.target) errors.push(domainError('INV-03', refs));
    if (target.kind === NodeKind.Input) errors.push(domainError('INV-02', refs));
    const kind = deriveEdgeKind(source.kind, target.kind);
    if (kind === undefined) errors.push(domainError('INV-05', refs));
    else if (kind !== edge.kind) errors.push(domainError('EDGE_KIND_MISMATCH', refs));
    const pair = JSON.stringify([edge.source, edge.target]);
    if (pairs.has(pair)) errors.push(domainError('INV-04', refs));
    pairs.add(pair);
  }

  const cycle = cycleNodes(graph);
  if (cycle.length > 0) errors.push(domainError('INV-06', { nodeIds: cycle }));

  const seenNames = new Map<string, NodeId>();
  for (const node of graph.nodes) {
    const shape = nameShapeProblem(node.name);
    if (shape !== undefined) {
      errors.push(domainError('INV-07', { nodeIds: [node.id], reason: shape }));
      continue;
    }
    const key = nameKey(node.name);
    const first = seenNames.get(key);
    if (first === undefined) seenNames.set(key, node.id);
    else errors.push(domainError('INV-07', { nodeIds: [first, node.id], reason: 'duplicate' }));
  }

  for (const node of graph.nodes) {
    if (node.kind === NodeKind.Supervisor && !isValidMaxRounds(node.maxRounds)) {
      errors.push(domainError('INV-08', { nodeIds: [node.id] }));
    }
  }
  return errors;
}
