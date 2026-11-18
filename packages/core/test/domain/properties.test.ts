// Testes de propriedade (SPEC §10): nenhum comando aceito produz grafo que viola invariante.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canAddNode,
  canConnect,
  checkGraph,
  deriveEdgeKind,
  EdgeKind,
  edgeId,
  type Graph,
  type GraphEdge,
  isSequenceKind,
  NodeKind,
  topologicalOrder,
  validateGraph,
} from '../../src/domain/index.ts';
import { graph, node } from './fixtures.ts';

type Command =
  | { type: 'add'; kind: NodeKind; x: number; y: number }
  | { type: 'connect'; source: number; target: number };

const command: fc.Arbitrary<Command> = fc.oneof(
  fc.record({
    type: fc.constant('add' as const),
    kind: fc.constantFrom(...Object.values(NodeKind)),
    x: fc.nat(4),
    y: fc.nat(4),
  }),
  fc.record({ type: fc.constant('connect' as const), source: fc.nat(), target: fc.nat() }),
);

const withEdge = (g: Graph, e: GraphEdge): Graph => ({ ...g, edges: [...g.edges, e] });

/** Aplica só os comandos que o domínio aceita, como fará a camada de aplicação. */
function build(commands: readonly Command[]): Graph {
  let g = graph([]);
  for (const c of commands) {
    if (c.type === 'add') {
      if (!canAddNode(g, c.kind).ok) continue;
      const id = `n${String(g.nodes.length)}`;
      g = { ...g, nodes: [...g.nodes, node(c.kind, id, { x: c.x, y: c.y })] };
      continue;
    }
    const source = g.nodes[c.source % Math.max(g.nodes.length, 1)];
    const target = g.nodes[c.target % Math.max(g.nodes.length, 1)];
    if (source === undefined || target === undefined) continue;
    const result = canConnect(g, source.id, target.id);
    if (result.ok) {
      g = withEdge(g, {
        id: edgeId(`e${String(g.edges.length)}`),
        source: source.id,
        target: target.id,
        kind: result.value,
      });
    }
  }
  return g;
}

const graphs = fc.array(command, { maxLength: 60 }).map(build);

describe('propriedades do domínio', () => {
  it('nenhum comando aceito produz grafo inválido', () => {
    fc.assert(
      fc.property(graphs, (g) => {
        expect(checkGraph(g)).toEqual([]);
      }),
    );
  });

  it('canConnect rejeita exatamente os fios que tornariam o grafo inválido', () => {
    fc.assert(
      fc.property(graphs, fc.nat(), fc.nat(), (g, i, j) => {
        fc.pre(g.nodes.length > 0);
        const source = g.nodes[i % g.nodes.length];
        const target = g.nodes[j % g.nodes.length];
        if (source === undefined || target === undefined) return;
        const forced = withEdge(g, {
          id: edgeId('forced'),
          source: source.id,
          target: target.id,
          kind: deriveEdgeKind(source.kind, target.kind) ?? EdgeKind.Flow,
        });
        expect(canConnect(g, source.id, target.id).ok).toBe(checkGraph(forced).length === 0);
      }),
    );
  });

  it('a ordem topológica respeita os fios e não depende da ordem dos arrays', () => {
    fc.assert(
      fc.property(graphs, (g) => {
        const order = topologicalOrder(g).map((n) => n.id);
        expect(order).toHaveLength(g.nodes.length);
        for (const e of g.edges.filter((edge) => isSequenceKind(edge.kind))) {
          expect(order.indexOf(e.source)).toBeLessThan(order.indexOf(e.target));
        }
        const shuffled = { ...g, nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() };
        expect(topologicalOrder(shuffled).map((n) => n.id)).toEqual(order);
      }),
    );
  });

  it('validateGraph é determinístico e cada item aponta para peças do grafo', () => {
    fc.assert(
      fc.property(graphs, (g) => {
        const issues = validateGraph(g);
        expect(validateGraph(g)).toEqual(issues);
        const known = new Set(g.nodes.map((n) => n.id));
        for (const item of issues) {
          for (const id of item.nodeIds) expect(known.has(id)).toBe(true);
        }
      }),
    );
  });
});
