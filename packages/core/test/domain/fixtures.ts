// Construtores de grafos para os testes do domínio.
import {
  deriveEdgeKind,
  type EdgeKind,
  EdgeKind as EK,
  edgeId,
  type Graph,
  type GraphEdge,
  type GraphNode,
  graphId,
  NodeKind,
  nodeId,
  SUPERVISOR_DEFAULTS,
} from '../../src/domain/index.ts';

export interface NodeSpec {
  name?: string;
  instructions?: string;
  x?: number;
  y?: number;
  maxRounds?: number;
}

export function node(kind: NodeKind, id: string, spec: NodeSpec = {}): GraphNode {
  const base = {
    id: nodeId(id),
    name: spec.name ?? id,
    instructions: spec.instructions ?? `instruções de ${id}`,
    position: { x: spec.x ?? 0, y: spec.y ?? 0 },
  };
  switch (kind) {
    case NodeKind.Supervisor:
      return {
        ...base,
        kind,
        presets: [],
        maxRounds: spec.maxRounds ?? SUPERVISOR_DEFAULTS.maxRounds,
        onExhausted: SUPERVISOR_DEFAULTS.onExhausted,
      };
    case NodeKind.Memory:
      return { ...base, kind, relations: ['ideia'] };
    default:
      return { ...base, kind };
  }
}

export interface LinkSpec {
  condition?: string;
  /** Força o tipo (para montar grafos inválidos); padrão: derivado (§3.2). */
  kind?: EdgeKind;
  id?: string;
}

export type Link = readonly [source: string, target: string, spec?: LinkSpec];

export function edgesFor(nodes: readonly GraphNode[], links: readonly Link[]): GraphEdge[] {
  const kindOf = new Map(nodes.map((n) => [n.id as string, n.kind]));
  return links.map(([source, target, spec = {}]) => {
    const s = kindOf.get(source);
    const t = kindOf.get(target);
    const derived = s !== undefined && t !== undefined ? deriveEdgeKind(s, t) : undefined;
    return {
      id: edgeId(spec.id ?? `${source}->${target}`),
      source: nodeId(source),
      target: nodeId(target),
      kind: spec.kind ?? derived ?? EK.Flow,
      ...(spec.condition === undefined ? {} : { condition: spec.condition }),
    };
  });
}

export function graph(
  nodes: readonly GraphNode[],
  links: readonly Link[] = [],
  objective = 'Entregar a headline da landing page.',
): Graph {
  return {
    id: graphId('g1'),
    schemaVersion: 1,
    name: 'Meu grafo',
    objective,
    nodes,
    edges: edgesFor(nodes, links),
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  };
}

/** Exemplo do SPEC §6: válido e sem itens em "Antes de exportar". */
export function landingPage(): Graph {
  const nodes = [
    node(NodeKind.Input, 'in', { x: 0 }),
    node(NodeKind.Worker, 'w1', { x: 100 }),
    node(NodeKind.Supervisor, 's1', { x: 200 }),
    node(NodeKind.Decision, 'd1', { x: 300 }),
    node(NodeKind.Worker, 'w2', { x: 400, y: 0 }),
    node(NodeKind.Delivery, 'e1', { x: 500, y: 100 }),
    node(NodeKind.Memory, 'm1', { x: 100, y: 300 }),
  ];
  return graph(nodes, [
    ['in', 'w1'],
    ['w1', 's1'],
    ['s1', 'd1'],
    ['d1', 'w2', { condition: 'há mais de uma headline aprovada' }],
    ['d1', 'e1', { condition: 'só uma aprovada' }],
    ['w2', 'e1'],
    ['w1', 'm1'],
    ['m1', 'w2'],
  ]);
}

export const ids = (items: readonly { id: string }[]): string[] => items.map((i) => i.id);
