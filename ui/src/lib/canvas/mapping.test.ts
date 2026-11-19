import { describe, expect, it } from 'vitest';
import {
  addNode,
  connectNodes,
  createGraph,
  type Graph,
  NodeKind,
  nodeId,
  setEdgeCondition,
  type EditResult,
} from '@graph-builder/core';
import { testContext } from '#lib/state/test-context.ts';
import { isReturnWire, isValidWire, toFlowEdges, toFlowNodes } from './mapping.ts';

const must = (result: EditResult): Graph => {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

/** Entrada → Trabalhador → Supervisor → Decisão → Entrega; Trabalhador → Memória → Entrega. */
function sample(): Graph {
  const ctx = testContext();
  let g = createGraph(ctx); // id1
  const kinds = [
    NodeKind.Input, // id2
    NodeKind.Worker, // id3
    NodeKind.Supervisor, // id4
    NodeKind.Decision, // id5
    NodeKind.Delivery, // id6
    NodeKind.Memory, // id7
  ];
  for (const [i, kind] of kinds.entries()) {
    g = must(addNode(ctx, g, { kind, position: { x: i * 240, y: 0 } }));
  }
  const link = (s: string, t: string) => {
    g = must(connectNodes(ctx, g, { source: nodeId(s), target: nodeId(t) }));
  };
  link('id2', 'id3');
  link('id3', 'id4');
  link('id4', 'id5');
  link('id5', 'id6'); // condição: id12
  link('id3', 'id7');
  link('id7', 'id6');
  return g;
}

describe('toFlowNodes', () => {
  it('copia posição, tipo e seleção', () => {
    const nodes = toFlowNodes(sample(), [nodeId('id3')]);
    expect(nodes).toHaveLength(6);
    expect(nodes[1]).toMatchObject({
      id: 'id3',
      type: 'piece',
      position: { x: 240, y: 0 },
      selected: true,
      class: 'piece-worker',
      data: { kind: NodeKind.Worker, name: 'Trabalhador 1', returnAnchor: true },
    });
    expect(nodes[0]?.selected).toBe(false);
  });

  it('ponto dourado só em Trabalhador e Entrega; relações só na Memória', () => {
    const nodes = toFlowNodes(sample(), []);
    expect(nodes.filter((n) => n.data.returnAnchor).map((n) => n.data.kind)).toEqual([
      NodeKind.Worker,
      NodeKind.Delivery,
    ]);
    expect(nodes.find((n) => n.data.kind === NodeKind.Memory)?.data.relations).toEqual([]);
  });

  it('contorno amarelo nas peças citadas em "Antes de exportar" (FR-20)', () => {
    const nodes = toFlowNodes(sample(), [], ['id3']);
    expect(nodes.filter((n) => n.data.flagged).map((n) => n.id)).toEqual(['id3']);
  });
});

describe('toFlowEdges (FR-09)', () => {
  it('fios do modelo com estilo e alças; retorno derivado no fim', () => {
    const edges = toFlowEdges(sample(), null);
    expect(edges.map((e) => [e.id, e.class])).toEqual([
      ['id8', 'wire wire-flow'],
      ['id9', 'wire wire-flow'],
      ['id10', 'wire wire-flow'],
      ['id11', 'wire wire-flow'],
      ['id12', 'wire wire-memory'],
      ['id13', 'wire wire-memory'],
      ['return:id4->id3', 'wire wire-return'],
    ]);
    expect(edges.every((e) => e.selectable === false)).toBe(true);
    expect(edges[0]).toMatchObject({ sourceHandle: 'out', targetHandle: 'in' });
    expect(edges.at(-1)).toMatchObject({
      source: 'id4',
      target: 'id3',
      sourceHandle: 'return-out',
      targetHandle: 'return-in',
    });
  });

  it('fio armado ganha a classe armed', () => {
    const edges = toFlowEdges(sample(), 'id9' as never);
    expect(edges.find((e) => e.id === 'id9')?.class).toBe('wire wire-flow armed');
  });

  it('condição escrita vira rótulo', () => {
    const g = must(setEdgeCondition(testContext(), sample(), 'id11' as never, 'se aprovado'));
    expect(toFlowEdges(g, null).find((e) => e.id === 'id11')?.label).toBe('se aprovado');
    expect(toFlowEdges(sample(), null).find((e) => e.id === 'id11')?.label).toBeUndefined();
  });

  it('isReturnWire', () => {
    expect(isReturnWire('return:a->b')).toBe(true);
    expect(isReturnWire('id8')).toBe(false);
  });
});

describe('isValidWire (FR-02)', () => {
  it('aceita o que o domínio aceita, só na alça de entrada', () => {
    const g = sample();
    expect(isValidWire(g, { source: 'id3', target: 'id6', targetHandle: 'in' })).toBe(true);
    expect(isValidWire(g, { source: 'id3', target: 'id6' })).toBe(true);
    expect(isValidWire(g, { source: 'id3', target: 'id6', targetHandle: 'return-in' })).toBe(false);
  });

  it('recusa INV-02 (Entrada recebe), INV-03 e INV-06 (ciclo)', () => {
    const g = sample();
    expect(isValidWire(g, { source: 'id3', target: 'id2' })).toBe(false);
    expect(isValidWire(g, { source: 'id3', target: 'id3' })).toBe(false);
    expect(isValidWire(g, { source: 'id6', target: 'id3' })).toBe(false);
  });
});
