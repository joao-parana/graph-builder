// Casos de uso de edição (SPEC §7.2). Puros sobre Graph imutável: devolvem um Graph novo ou um
// DomainError. Sem mudança, devolvem o mesmo objeto (o histórico ignora; FR-08).
import {
  addPresetLine,
  BAR_PRESET_TEXT,
  type BarPresetId,
  canAddNode,
  canConnect,
  checkGraphName,
  checkNodeName,
  DEFAULT_GRAPH_NAME,
  type DomainError,
  domainError,
  EdgeKind,
  type EdgeId,
  edgeId,
  err,
  type Graph,
  type GraphEdge,
  graphId,
  type GraphNode,
  isValidMaxRounds,
  nextNodeName,
  type NodeId,
  nodeId,
  NodeKind,
  ok,
  type OnExhausted,
  type Position,
  removePresetLine,
  type Result,
  SCHEMA_VERSION,
  SUPERVISOR_DEFAULTS,
} from '../domain/index.ts';
import type { EditContext, LayoutEngine } from './ports.ts';

export type EditResult = Result<Graph, DomainError>;

/** Grade do snap (FR-06) e deslocamento da cópia (FR-05), em px. */
export const GRID_SIZE = 16;
export const DUPLICATE_OFFSET = 32;

const touch = (ctx: EditContext, graph: Graph, changes: Partial<Graph>): Graph => ({
  ...graph,
  ...changes,
  updatedAt: ctx.clock.now(),
});

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const notFound = (id: NodeId): EditResult => err(domainError('NODE_NOT_FOUND', { nodeIds: [id] }));

function replaceNode(ctx: EditContext, graph: Graph, updated: GraphNode): Graph {
  const current = graph.nodes.find((node) => node.id === updated.id);
  if (same(current, updated)) return graph;
  return touch(ctx, graph, {
    nodes: graph.nodes.map((node) => (node.id === updated.id ? updated : node)),
  });
}

function makeNode(kind: NodeKind, id: NodeId, name: string, position: Position): GraphNode {
  const base = { id, name, instructions: '', position };
  switch (kind) {
    case NodeKind.Supervisor:
      return { ...base, kind, presets: [], ...SUPERVISOR_DEFAULTS };
    case NodeKind.Memory:
      return { ...base, kind, relations: [] };
    default:
      return { ...base, kind };
  }
}

/** CreateGraph: grafo vazio "Meu grafo". */
export function createGraph(ctx: EditContext): Graph {
  const now = ctx.clock.now();
  return {
    id: graphId(ctx.ids.next()),
    schemaVersion: SCHEMA_VERSION,
    name: DEFAULT_GRAPH_NAME,
    objective: '',
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: now,
    updatedAt: now,
  };
}

/** AddNode (FR-01): a peça nova fica no fim de `nodes`. */
export function addNode(
  ctx: EditContext,
  graph: Graph,
  input: { kind: NodeKind; position: Position },
): EditResult {
  const allowed = canAddNode(graph, input.kind);
  if (!allowed.ok) return allowed;
  const node = makeNode(
    input.kind,
    nodeId(ctx.ids.next()),
    nextNodeName(graph, input.kind),
    input.position,
  );
  return ok(touch(ctx, graph, { nodes: [...graph.nodes, node] }));
}

/** ConnectNodes (FR-02): o fio novo fica no fim de `edges`, com o tipo derivado (§3.2). */
export function connectNodes(
  ctx: EditContext,
  graph: Graph,
  input: { source: NodeId; target: NodeId },
): EditResult {
  const kind = canConnect(graph, input.source, input.target);
  if (!kind.ok) return kind;
  const edge: GraphEdge = {
    id: edgeId(ctx.ids.next()),
    source: input.source,
    target: input.target,
    kind: kind.value,
  };
  return ok(touch(ctx, graph, { edges: [...graph.edges, edge] }));
}

/** DisconnectEdge (FR-03). */
export function disconnectEdge(ctx: EditContext, graph: Graph, id: EdgeId): EditResult {
  if (!graph.edges.some((edge) => edge.id === id)) {
    return err(domainError('EDGE_NOT_FOUND', { edgeIds: [id] }));
  }
  return ok(touch(ctx, graph, { edges: graph.edges.filter((edge) => edge.id !== id) }));
}

export interface NodePatch {
  readonly name?: string;
  readonly instructions?: string;
  /** Só Supervisor. */
  readonly maxRounds?: number;
  /** Só Supervisor. */
  readonly onExhausted?: OnExhausted;
  /** Só Memória. */
  readonly relations?: readonly string[];
}

const normalizeRelations = (relations: readonly string[]): readonly string[] => [
  ...new Set(relations.map((r) => r.trim()).filter((r) => r.length > 0)),
];

/** UpdateNode (FR-11..15). */
export function updateNode(
  ctx: EditContext,
  graph: Graph,
  id: NodeId,
  patch: NodePatch,
): EditResult {
  const node = graph.nodes.find((n) => n.id === id);
  if (node === undefined) return notFound(id);
  const supervisorOnly = patch.maxRounds !== undefined || patch.onExhausted !== undefined;
  if (
    (supervisorOnly && node.kind !== NodeKind.Supervisor) ||
    (patch.relations !== undefined && node.kind !== NodeKind.Memory)
  ) {
    return err(domainError('NOT_APPLICABLE', { nodeIds: [id] }));
  }

  const name = patch.name === undefined ? node.name : patch.name.trim();
  if (patch.name !== undefined) {
    const valid = checkNodeName(graph, name, id);
    if (!valid.ok) return valid;
  }
  if (patch.maxRounds !== undefined && !isValidMaxRounds(patch.maxRounds)) {
    return err(domainError('INV-08', { nodeIds: [id] }));
  }
  const common = { name, instructions: patch.instructions ?? node.instructions };

  let updated: GraphNode;
  switch (node.kind) {
    case NodeKind.Supervisor:
      updated = {
        ...node,
        ...common,
        maxRounds: patch.maxRounds ?? node.maxRounds,
        onExhausted: patch.onExhausted ?? node.onExhausted,
      };
      break;
    case NodeKind.Memory:
      updated = {
        ...node,
        ...common,
        relations:
          patch.relations === undefined ? node.relations : normalizeRelations(patch.relations),
      };
      break;
    default:
      updated = { ...node, ...common };
  }
  return ok(replaceNode(ctx, graph, updated));
}

const snapTo = (value: number): number => Math.round(value / GRID_SIZE) * GRID_SIZE;

/** MoveNode (FR-06). A UI chama ao soltar a peça, não a cada passo do arraste. */
export function moveNode(
  ctx: EditContext,
  graph: Graph,
  id: NodeId,
  position: Position,
  options: { snap?: boolean } = {},
): EditResult {
  const node = graph.nodes.find((n) => n.id === id);
  if (node === undefined) return notFound(id);
  const next = options.snap === true ? { x: snapTo(position.x), y: snapTo(position.y) } : position;
  return ok(replaceNode(ctx, graph, { ...node, position: next }));
}

/** DuplicateNode (FR-05): copia tipo, instruções e configs; não copia fios. */
export function duplicateNode(ctx: EditContext, graph: Graph, id: NodeId): EditResult {
  const node = graph.nodes.find((n) => n.id === id);
  if (node === undefined) return notFound(id);
  const allowed = canAddNode(graph, node.kind);
  if (!allowed.ok) return allowed;
  const copy: GraphNode = {
    ...node,
    id: nodeId(ctx.ids.next()),
    name: nextNodeName(graph, node.kind),
    position: { x: node.position.x + DUPLICATE_OFFSET, y: node.position.y + DUPLICATE_OFFSET },
  };
  return ok(touch(ctx, graph, { nodes: [...graph.nodes, copy] }));
}

/** DeleteNode (FR-04): remove também os fios ligados. */
export function deleteNode(ctx: EditContext, graph: Graph, id: NodeId): EditResult {
  if (!graph.nodes.some((node) => node.id === id)) return notFound(id);
  return ok(
    touch(ctx, graph, {
      nodes: graph.nodes.filter((node) => node.id !== id),
      edges: graph.edges.filter((edge) => edge.source !== id && edge.target !== id),
    }),
  );
}

/** ToggleBarPreset (FR-12, Q6). */
export function toggleBarPreset(
  ctx: EditContext,
  graph: Graph,
  id: NodeId,
  preset: BarPresetId,
): EditResult {
  const node = graph.nodes.find((n) => n.id === id);
  if (node === undefined) return notFound(id);
  if (node.kind !== NodeKind.Supervisor) {
    return err(domainError('NOT_APPLICABLE', { nodeIds: [id] }));
  }
  const text = BAR_PRESET_TEXT[preset];
  const active = node.presets.includes(preset);
  return ok(
    replaceNode(ctx, graph, {
      ...node,
      presets: active ? node.presets.filter((p) => p !== preset) : [...node.presets, preset],
      instructions: active
        ? removePresetLine(node.instructions, text)
        : addPresetLine(node.instructions, text),
    }),
  );
}

/** SetEdgeCondition (FR-13): só em fio que sai de Decisão. */
export function setEdgeCondition(
  ctx: EditContext,
  graph: Graph,
  id: EdgeId,
  condition: string,
): EditResult {
  const edge = graph.edges.find((e) => e.id === id);
  if (edge === undefined) return err(domainError('EDGE_NOT_FOUND', { edgeIds: [id] }));
  if (edge.kind !== EdgeKind.Condition) {
    return err(domainError('NOT_APPLICABLE', { edgeIds: [id] }));
  }
  if (edge.condition === condition) return ok(graph);
  return ok(
    touch(ctx, graph, {
      edges: graph.edges.map((e) => (e.id === id ? { ...e, condition } : e)),
    }),
  );
}

/** UpdateGraph (FR-10, FR-33): nome (INV-09) e objetivo. */
export function updateGraph(
  ctx: EditContext,
  graph: Graph,
  patch: { name?: string; objective?: string },
): EditResult {
  const name = patch.name === undefined ? graph.name : patch.name.trim();
  const valid = checkGraphName(name);
  if (!valid.ok) return valid;
  const objective = patch.objective ?? graph.objective;
  if (name === graph.name && objective === graph.objective) return ok(graph);
  return ok(touch(ctx, graph, { name, objective }));
}

/** ClearGraph (FR-32): apaga peças e fios; mantém nome, objetivo e viewport. */
export function clearGraph(ctx: EditContext, graph: Graph): EditResult {
  if (graph.nodes.length === 0 && graph.edges.length === 0) return ok(graph);
  return ok(touch(ctx, graph, { nodes: [], edges: [] }));
}

/** AutoLayout (FR-07 "Arrumar"): peças fora do resultado do layout ficam onde estão. */
export function autoLayout(ctx: EditContext, graph: Graph, engine: LayoutEngine): EditResult {
  const positions = engine.layout(graph);
  const nodes = graph.nodes.map((node) => {
    const position = positions.get(node.id);
    return position === undefined ? node : { ...node, position };
  });
  return ok(same(nodes, graph.nodes) ? graph : touch(ctx, graph, { nodes }));
}
