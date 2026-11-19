import { describe, expect, it } from 'vitest';
import { autoLayout } from '../../src/application/index.ts';
import { type NodeId, NodeKind, nodeId, type Position } from '../../src/domain/index.ts';
import { dagreLayoutEngine, NODE_WIDTH } from '../../src/infrastructure/dagre-layout.ts';
import { context } from '../application/fakes.ts';
import { graph, landingPage, node } from '../domain/fixtures.ts';

function at(positions: ReadonlyMap<NodeId, Position>, id: string): Position {
  const position = positions.get(nodeId(id));
  if (position === undefined) throw new Error(`sem posição para ${id}`);
  return position;
}

describe('dagreLayoutEngine', () => {
  it('dá posição inteira a todas as peças', () => {
    const g = landingPage();
    const positions = dagreLayoutEngine.layout(g);
    expect([...positions.keys()].sort()).toEqual(g.nodes.map((n) => n.id).sort());
    for (const { x, y } of positions.values()) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    }
  });

  it('cadeia fica da esquerda para a direita, sem sobrepor', () => {
    const nodes = ['a', 'b', 'c'].map((id) => node(NodeKind.Worker, id, { x: 500, y: 500 }));
    const positions = dagreLayoutEngine.layout(
      graph(nodes, [
        ['a', 'b'],
        ['b', 'c'],
      ]),
    );
    const [a, b, c] = [at(positions, 'a'), at(positions, 'b'), at(positions, 'c')];
    expect(b.x - a.x).toBeGreaterThanOrEqual(NODE_WIDTH);
    expect(c.x - b.x).toBeGreaterThanOrEqual(NODE_WIDTH);
    expect(a.y).toBe(b.y);
    expect(Math.min(a.x, a.y)).toBe(0);
  });

  it('segue a ordem topológica (landing page)', () => {
    const positions = dagreLayoutEngine.layout(landingPage());
    const x = (id: string) => at(positions, id).x;
    expect(x('in')).toBeLessThan(x('w1'));
    expect(x('w1')).toBeLessThan(x('s1'));
    expect(x('s1')).toBeLessThan(x('d1'));
    expect(x('d1')).toBeLessThan(x('e1'));
    expect(x('w2')).toBeLessThan(x('e1'));
  });

  it('é determinístico: mesma saída com peças e fios em outra ordem', () => {
    const g = landingPage();
    const expected = [...dagreLayoutEngine.layout(g)].sort();
    const reversed = { ...g, nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() };
    expect([...dagreLayoutEngine.layout(reversed)].sort()).toEqual(expected);
    expect([...dagreLayoutEngine.layout(g)].sort()).toEqual(expected);
  });

  it('ignora fio com ponta inexistente e aceita grafo vazio', () => {
    const g = graph([node(NodeKind.Worker, 'a')], [['a', 'fantasma']]);
    expect(dagreLayoutEngine.layout(g).size).toBe(1);
    expect(dagreLayoutEngine.layout(graph([])).size).toBe(0);
  });

  it('serve ao caso de uso AutoLayout (FR-07)', () => {
    const result = autoLayout(context(), landingPage(), dagreLayoutEngine);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const positions = dagreLayoutEngine.layout(landingPage());
      for (const n of result.value.nodes) expect(n.position).toEqual(positions.get(n.id));
    }
  });
});
