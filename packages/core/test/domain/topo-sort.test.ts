import { describe, expect, it } from 'vitest';
import { type Graph, NodeKind, topologicalOrder } from '../../src/domain/index.ts';
import { graph, ids, landingPage, node } from './fixtures.ts';

const reversed = (g: Graph): Graph => ({
  ...g,
  nodes: [...g.nodes].reverse(),
  edges: [...g.edges].reverse(),
});

describe('topologicalOrder (FR-21)', () => {
  it('segue os fios Flow/Condition do exemplo do SPEC §6', () => {
    expect(ids(topologicalOrder(landingPage()))).toEqual([
      'in',
      'w1',
      'm1',
      's1',
      'd1',
      'w2',
      'e1',
    ]);
  });

  it('não depende da ordem dos arrays de peças e fios', () => {
    const g = landingPage();
    expect(ids(topologicalOrder(reversed(g)))).toEqual(ids(topologicalOrder(g)));
  });

  it('desempata por x, depois y, depois id', () => {
    const g = graph([
      node(NodeKind.Worker, 'b', { x: 10, y: 5 }),
      node(NodeKind.Worker, 'a', { x: 10, y: 5 }),
      node(NodeKind.Worker, 'c', { x: 10, y: 1 }),
      node(NodeKind.Worker, 'd', { x: 0, y: 9 }),
    ]);
    expect(ids(topologicalOrder(g))).toEqual(['d', 'c', 'a', 'b']);
  });

  it('fios de Memória não impõem ordem', () => {
    const g = graph(
      [node(NodeKind.Worker, 'w', { x: 0 }), node(NodeKind.Memory, 'm', { x: 50 })],
      [['m', 'w']],
    );
    expect(ids(topologicalOrder(g))).toEqual(['w', 'm']);
  });

  it('num grafo com ciclo, as peças presas vão ao fim, ordenadas', () => {
    const g = graph(
      [
        node(NodeKind.Worker, 'a', { x: 0 }),
        node(NodeKind.Worker, 'b', { x: 30 }),
        node(NodeKind.Worker, 'c', { x: 20 }),
        node(NodeKind.Worker, 'z', { x: 99 }),
      ],
      [
        ['b', 'c'],
        ['c', 'b'],
        ['a', 'b'],
      ],
    );
    expect(ids(topologicalOrder(g))).toEqual(['a', 'z', 'c', 'b']);
  });

  it('ignora fio para peça inexistente', () => {
    const g = graph([node(NodeKind.Worker, 'a')], [['a', 'x']]);
    expect(ids(topologicalOrder(g))).toEqual(['a']);
  });
});
