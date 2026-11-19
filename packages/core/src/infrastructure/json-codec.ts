// GraphCodec em JSON (FR-22, SPEC §7.1): texto estável na ida, erros com caminho do campo na volta.
import { z } from 'zod';
import type { CodecIssue, GraphCodec } from '../application/index.ts';
import {
  err,
  type Graph,
  type GraphEdge,
  type GraphNode,
  NodeKind,
  ok,
  type Result,
  SCHEMA_VERSION,
} from '../domain/index.ts';
import { graphSchemaV1 } from './graph-schema.ts';

const ROOT = '$';
const ptBR = z.locales.ptBR().localeError;

/** `["nodes", 2, "name"]` → `nodes[2].name`; caminho vazio → `$`. */
export function formatPath(path: readonly PropertyKey[]): string {
  let text = '';
  for (const segment of path) {
    if (typeof segment === 'number') text += `[${String(segment)}]`;
    else text += text.length === 0 ? String(segment) : `.${String(segment)}`;
  }
  return text.length === 0 ? ROOT : text;
}

// Chaves em ordem fixa: o mesmo grafo gera sempre o mesmo texto.
function nodeDocument(node: GraphNode): Record<string, unknown> {
  const base = {
    id: node.id,
    kind: node.kind,
    name: node.name,
    instructions: node.instructions,
    position: { x: node.position.x, y: node.position.y },
  };
  switch (node.kind) {
    case NodeKind.Supervisor:
      return {
        ...base,
        presets: node.presets,
        maxRounds: node.maxRounds,
        onExhausted: node.onExhausted,
      };
    case NodeKind.Memory:
      return { ...base, relations: node.relations };
    default:
      return base;
  }
}

const edgeDocument = (edge: GraphEdge): Record<string, unknown> => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  kind: edge.kind,
  ...(edge.condition === undefined ? {} : { condition: edge.condition }),
});

const issue = (path: string, message: string): readonly CodecIssue[] => [{ path, message }];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Só a versão 1 existe; uma versão nova entra aqui com a sua migração. */
function checkVersion(document: Record<string, unknown>): readonly CodecIssue[] {
  const version = document['schemaVersion'];
  if (version === SCHEMA_VERSION) return [];
  if (version === undefined) return issue('schemaVersion', 'Falta o campo schemaVersion.');
  return issue(
    'schemaVersion',
    `Versão ${JSON.stringify(version)} não suportada; este app lê a versão ${String(SCHEMA_VERSION)}.`,
  );
}

export const jsonGraphCodec: GraphCodec = {
  encode(graph: Graph): string {
    const document = {
      id: graph.id,
      schemaVersion: graph.schemaVersion,
      name: graph.name,
      objective: graph.objective,
      nodes: graph.nodes.map(nodeDocument),
      edges: graph.edges.map(edgeDocument),
      viewport: { x: graph.viewport.x, y: graph.viewport.y, zoom: graph.viewport.zoom },
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
    };
    return `${JSON.stringify(document, null, 2)}\n`;
  },

  decode(text: string): Result<Graph, readonly CodecIssue[]> {
    let document: unknown;
    try {
      document = JSON.parse(text);
    } catch (error) {
      // JSON.parse só lança SyntaxError; a mensagem traz a posição do problema.
      return err(issue(ROOT, `O texto não é um JSON válido (${String(error)}).`));
    }
    if (!isRecord(document)) return err(issue(ROOT, 'Esperava um objeto JSON com o grafo.'));
    const versionIssues = checkVersion(document);
    if (versionIssues.length > 0) return err(versionIssues);

    const parsed = graphSchemaV1.safeParse(document, { error: ptBR });
    if (!parsed.success) {
      return err(
        parsed.error.issues.map((item) => ({ path: formatPath(item.path), message: item.message })),
      );
    }
    return ok(parsed.data);
  },
};
