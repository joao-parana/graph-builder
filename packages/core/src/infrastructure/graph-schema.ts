// Schema zod do JSON do grafo, versão 1 (SPEC §3.1, FR-22). Só forma; INV de grafo ficam no
// `checkGraph` do `ImportJson`.
import { z } from 'zod';
import {
  BAR_PRESET_IDS,
  edgeId,
  EdgeKind,
  graphId,
  MAX_ROUNDS_MAX,
  MAX_ROUNDS_MIN,
  type NameProblem,
  nameShapeProblem,
  NodeKind,
  nodeId,
  SCHEMA_VERSION,
} from '../domain/index.ts';

// SPEC §9.4: sem compilar validadores com `new Function` (a CSP barra `eval`); sem isso, o teste do
// zod gera uma violação no console. Tem que vir antes de criar os schemas abaixo.
z.config({ jitless: true });

export const NAME_PROBLEM_MESSAGE: Readonly<Record<NameProblem, string>> = {
  empty: 'O nome não pode ficar vazio.',
  'too-long': 'O nome passa de 80 caracteres.',
  duplicate: 'Já existe uma peça com esse nome.',
};

const name = z.string().superRefine((value, ctx) => {
  const problem = nameShapeProblem(value);
  if (problem !== undefined)
    ctx.addIssue({ code: 'custom', message: NAME_PROBLEM_MESSAGE[problem] });
});

const id = z.string().min(1);
const finite = z.number().refine(Number.isFinite);
const position = z.object({ x: finite, y: finite });

const baseNode = {
  id: id.transform(nodeId),
  name,
  instructions: z.string(),
  position,
};

const plainNode = (
  kind: NodeKind.Input | NodeKind.Worker | NodeKind.Delivery | NodeKind.Decision,
) => z.object({ ...baseNode, kind: z.literal(kind) });

const supervisorNode = z.object({
  ...baseNode,
  kind: z.literal(NodeKind.Supervisor),
  presets: z.array(z.enum(BAR_PRESET_IDS)),
  maxRounds: z.number().int().min(MAX_ROUNDS_MIN).max(MAX_ROUNDS_MAX),
  onExhausted: z.enum(['deliver-best-with-caveats', 'fail']),
});

const memoryNode = z.object({
  ...baseNode,
  kind: z.literal(NodeKind.Memory),
  relations: z.array(z.string()),
});

const graphNode = z.discriminatedUnion('kind', [
  plainNode(NodeKind.Input),
  plainNode(NodeKind.Worker),
  plainNode(NodeKind.Delivery),
  plainNode(NodeKind.Decision),
  supervisorNode,
  memoryNode,
]);

const graphEdge = z.object({
  id: id.transform(edgeId),
  source: id.transform(nodeId),
  target: id.transform(nodeId),
  kind: z.enum(EdgeKind),
  condition: z.string().optional(),
});

export const graphSchemaV1 = z.object({
  id: id.transform(graphId),
  schemaVersion: z.literal(SCHEMA_VERSION),
  name,
  objective: z.string(),
  nodes: z.array(graphNode),
  edges: z.array(graphEdge),
  viewport: z.object({ x: finite, y: finite, zoom: finite.refine((zoom) => zoom > 0) }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
