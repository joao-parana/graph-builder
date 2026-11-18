import { describe, expect, it } from 'vitest';
import {
  addNode,
  autoLayout,
  clearGraph,
  connectNodes,
  createGraph,
  deleteNode,
  disconnectEdge,
  duplicateNode,
  type EditResult,
  moveNode,
  setEdgeCondition,
  toggleBarPreset,
  updateGraph,
  updateNode,
} from '../../src/application/index.ts';
import {
  checkGraph,
  EdgeKind,
  edgeId,
  type Graph,
  type GraphNode,
  NodeKind,
  nodeId,
} from '../../src/domain/index.ts';
import { graph, landingPage, node } from '../domain/fixtures.ts';
import { context, rowLayout } from './fakes.ts';

const id = nodeId;
const P = { x: 0, y: 0 };

/** Valor de um resultado que deve ser ok. */
function value(result: EditResult): Graph {
  if (!result.ok) throw new Error(`esperava ok, veio ${result.error.code}`);
  return result.value;
}

const code = (result: EditResult): string | undefined =>
  result.ok ? undefined : result.error.code;
const last = (g: Graph): GraphNode | undefined => g.nodes.at(-1);
const byId = (g: Graph, nid: string): GraphNode | undefined => g.nodes.find((n) => n.id === nid);

describe('createGraph', () => {
  it('cria "Meu grafo" vazio, sem objetivo, com id e datas', () => {
    const g = createGraph(context());
    expect(g).toEqual({
      id: 'id-1',
      schemaVersion: 1,
      name: 'Meu grafo',
      objective: '',
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    });
  });
});

describe('addNode (FR-01)', () => {
  it('põe a peça nova no fim, com nome automático e updatedAt novo', () => {
    const ctx = context();
    const g = value(
      addNode(ctx, createGraph(ctx), { kind: NodeKind.Worker, position: { x: 5, y: 6 } }),
    );
    expect(last(g)).toEqual({
      id: 'id-2',
      kind: NodeKind.Worker,
      name: 'Trabalhador 1',
      instructions: '',
      position: { x: 5, y: 6 },
    });
    expect(g.updatedAt).toBe('2026-11-18T00:00:01.000Z');
  });

  it('Supervisor nasce com os padrões e sem presets; Memória sem relações', () => {
    const ctx = context();
    let g = value(addNode(ctx, createGraph(ctx), { kind: NodeKind.Supervisor, position: P }));
    expect(last(g)).toMatchObject({
      presets: [],
      maxRounds: 3,
      onExhausted: 'deliver-best-with-caveats',
    });
    g = value(addNode(ctx, g, { kind: NodeKind.Memory, position: P }));
    expect(last(g)).toMatchObject({ name: 'Memória 1', relations: [] });
  });

  it('usa o menor n livre', () => {
    const ctx = context();
    const g = graph([
      node(NodeKind.Worker, 'a', { name: 'Trabalhador 1' }),
      node(NodeKind.Worker, 'b', { name: 'Trabalhador 3' }),
    ]);
    expect(last(value(addNode(ctx, g, { kind: NodeKind.Worker, position: P })))?.name).toBe(
      'Trabalhador 2',
    );
  });

  it('rejeita a segunda Entrada (INV-01)', () => {
    expect(code(addNode(context(), landingPage(), { kind: NodeKind.Input, position: P }))).toBe(
      'INV-01',
    );
  });
});

describe('connectNodes / disconnectEdge (FR-02, FR-03)', () => {
  it('cria o fio no fim, com o tipo derivado', () => {
    const g = graph([node(NodeKind.Decision, 'd'), node(NodeKind.Worker, 'w')]);
    const next = value(connectNodes(context(), g, { source: id('d'), target: id('w') }));
    expect(next.edges).toEqual([
      { id: 'id-1', source: 'd', target: 'w', kind: EdgeKind.Condition },
    ]);
  });

  it('repassa o erro da invariante', () => {
    expect(
      code(connectNodes(context(), landingPage(), { source: id('s1'), target: id('w1') })),
    ).toBe('INV-06');
  });

  it('corta o fio pelo id', () => {
    const next = value(disconnectEdge(context(), landingPage(), edgeId('w1->s1')));
    expect(next.edges.some((e) => e.id === 'w1->s1')).toBe(false);
    expect(next.edges).toHaveLength(landingPage().edges.length - 1);
  });

  it('fio inexistente → EDGE_NOT_FOUND', () => {
    expect(code(disconnectEdge(context(), landingPage(), edgeId('x')))).toBe('EDGE_NOT_FOUND');
  });
});

describe('updateNode (FR-11..15)', () => {
  const g = landingPage();

  it('muda nome (sem espaços nas pontas) e instruções', () => {
    const next = value(
      updateNode(context(), g, id('w1'), { name: '  Redator ', instructions: 'x' }),
    );
    expect(byId(next, 'w1')).toMatchObject({ name: 'Redator', instructions: 'x' });
  });

  it('muda rodadas e o que fazer ao esgotar no Supervisor', () => {
    const next = value(updateNode(context(), g, id('s1'), { maxRounds: 5, onExhausted: 'fail' }));
    expect(byId(next, 's1')).toMatchObject({ maxRounds: 5, onExhausted: 'fail' });
  });

  it('normaliza as relações da Memória', () => {
    const next = value(
      updateNode(context(), g, id('m1'), { relations: [' ideia', 'ideia', '', 'contradiz '] }),
    );
    expect(byId(next, 'm1')).toMatchObject({ relations: ['ideia', 'contradiz'] });
  });

  it('sem mudança devolve o mesmo grafo', () => {
    expect(value(updateNode(context(), g, id('w1'), { name: 'w1' }))).toBe(g);
    expect(value(updateNode(context(), g, id('m1'), {}))).toBe(g);
  });

  it.each([
    ['peça inexistente', 'x', { name: 'a' }, 'NODE_NOT_FOUND'],
    ['nome vazio', 'w1', { name: ' ' }, 'INV-07'],
    ['nome repetido', 'w1', { name: 'W2' }, 'INV-07'],
    ['rodadas fora da faixa', 's1', { maxRounds: 11 }, 'INV-08'],
    ['rodadas em Trabalhador', 'w1', { maxRounds: 2 }, 'NOT_APPLICABLE'],
    ['esgotar em Trabalhador', 'w1', { onExhausted: 'fail' as const }, 'NOT_APPLICABLE'],
    ['relações em Supervisor', 's1', { relations: ['a'] }, 'NOT_APPLICABLE'],
  ])('%s → %s', (_label, nid, patch, expected) => {
    expect(code(updateNode(context(), g, id(nid), patch))).toBe(expected);
  });
});

describe('moveNode (FR-06)', () => {
  it('move sem snap', () => {
    const next = value(moveNode(context(), landingPage(), id('w1'), { x: 7, y: 9 }));
    expect(byId(next, 'w1')?.position).toEqual({ x: 7, y: 9 });
  });

  it('com snap, arredonda para a grade de 16 px', () => {
    const next = value(
      moveNode(context(), landingPage(), id('w1'), { x: 7, y: 25 }, { snap: true }),
    );
    expect(byId(next, 'w1')?.position).toEqual({ x: 0, y: 32 });
  });

  it('mesma posição devolve o mesmo grafo; peça inexistente é erro', () => {
    const g = landingPage();
    expect(value(moveNode(context(), g, id('w1'), { x: 100, y: 0 }))).toBe(g);
    expect(code(moveNode(context(), g, id('x'), P))).toBe('NODE_NOT_FOUND');
  });
});

describe('duplicateNode (FR-05)', () => {
  it('copia configs, desloca 32 px, ganha nome novo e não copia fios', () => {
    const g = value(
      updateNode(context(), landingPage(), id('s1'), { maxRounds: 7, name: 'Supervisor 1' }),
    );
    const next = value(duplicateNode(context(), g, id('s1')));
    expect(last(next)).toMatchObject({
      id: 'id-1',
      kind: NodeKind.Supervisor,
      name: 'Supervisor 2',
      maxRounds: 7,
      instructions: 'instruções de s1',
      position: { x: 232, y: 32 },
    });
    expect(next.edges).toEqual(g.edges);
  });

  it('não duplica a Entrada (INV-01) nem peça inexistente', () => {
    expect(code(duplicateNode(context(), landingPage(), id('in')))).toBe('INV-01');
    expect(code(duplicateNode(context(), landingPage(), id('x')))).toBe('NODE_NOT_FOUND');
  });
});

describe('deleteNode (FR-04)', () => {
  it('remove a peça e os fios ligados a ela', () => {
    const next = value(deleteNode(context(), landingPage(), id('w1')));
    expect(next.nodes.map((n) => n.id)).not.toContain('w1');
    expect(next.edges.filter((e) => e.source === 'w1' || e.target === 'w1')).toEqual([]);
    expect(next.edges).toHaveLength(5);
    expect(checkGraph(next)).toEqual([]);
  });

  it('peça inexistente → NODE_NOT_FOUND', () => {
    expect(code(deleteNode(context(), landingPage(), id('x')))).toBe('NODE_NOT_FOUND');
  });
});

describe('toggleBarPreset (FR-12, Q6)', () => {
  const g = graph([node(NodeKind.Supervisor, 's', { instructions: 'Reprove se faltar prova.' })]);

  it('liga: ativa o preset e põe o texto numa linha nova', () => {
    const next = value(toggleBarPreset(context(), g, id('s'), 'wow'));
    expect(byId(next, 's')).toMatchObject({
      presets: ['wow'],
      instructions: 'Reprove se faltar prova.\nTodo crítico aprova com reação "uau".',
    });
  });

  it('desliga: tira o preset e exatamente a linha dele', () => {
    const ctx = context();
    const on = value(toggleBarPreset(ctx, g, id('s'), 'wow'));
    const both = value(toggleBarPreset(ctx, on, id('s'), 'no-errors'));
    const off = value(toggleBarPreset(ctx, both, id('s'), 'wow'));
    expect(byId(off, 's')).toMatchObject({
      presets: ['no-errors'],
      instructions:
        'Reprove se faltar prova.\nRoda limpo, inclusive com casos de borda e erros forçados.',
    });
  });

  it('só em Supervisor', () => {
    expect(code(toggleBarPreset(context(), landingPage(), id('w1'), 'wow'))).toBe('NOT_APPLICABLE');
    expect(code(toggleBarPreset(context(), landingPage(), id('x'), 'wow'))).toBe('NODE_NOT_FOUND');
  });
});

describe('setEdgeCondition (FR-13)', () => {
  const g = landingPage();

  it('grava a condição do fio de Decisão', () => {
    const next = value(setEdgeCondition(context(), g, edgeId('d1->w2'), 'se houver duas'));
    expect(next.edges.find((e) => e.id === 'd1->w2')?.condition).toBe('se houver duas');
  });

  it('mesma condição devolve o mesmo grafo', () => {
    expect(value(setEdgeCondition(context(), g, edgeId('d1->e1'), 'só uma aprovada'))).toBe(g);
  });

  it('só em fio Condition, e o fio precisa existir', () => {
    expect(code(setEdgeCondition(context(), g, edgeId('w1->s1'), 'x'))).toBe('NOT_APPLICABLE');
    expect(code(setEdgeCondition(context(), g, edgeId('x'), 'x'))).toBe('EDGE_NOT_FOUND');
  });
});

describe('updateGraph (FR-10, FR-33)', () => {
  it('muda nome (sem espaços nas pontas) e objetivo', () => {
    const next = value(
      updateGraph(context(), landingPage(), { name: ' Landing ', objective: 'X' }),
    );
    expect(next).toMatchObject({ name: 'Landing', objective: 'X' });
  });

  it('sem mudança devolve o mesmo grafo', () => {
    const g = landingPage();
    expect(value(updateGraph(context(), g, {}))).toBe(g);
  });

  it('nome vazio ou longo → INV-09', () => {
    expect(code(updateGraph(context(), landingPage(), { name: '' }))).toBe('INV-09');
    expect(code(updateGraph(context(), landingPage(), { name: 'x'.repeat(81) }))).toBe('INV-09');
  });
});

describe('clearGraph (FR-32)', () => {
  it('apaga peças e fios e mantém nome, objetivo e viewport', () => {
    const g = landingPage();
    const next = value(clearGraph(context(), g));
    expect(next).toMatchObject({ nodes: [], edges: [], name: g.name, objective: g.objective });
    expect(next.viewport).toEqual(g.viewport);
  });

  it('grafo já vazio devolve o mesmo grafo', () => {
    const g = graph([]);
    expect(value(clearGraph(context(), g))).toBe(g);
  });
});

describe('autoLayout (FR-07)', () => {
  it('aplica as posições do LayoutEngine', () => {
    const next = value(autoLayout(context(), landingPage(), rowLayout));
    expect(next.nodes.map((n) => n.position.x)).toEqual([0, 200, 600, 800, 1000, 1200, 400]);
  });

  it('peças fora do layout ficam onde estão; sem mudança devolve o mesmo grafo', () => {
    const g = landingPage();
    expect(value(autoLayout(context(), g, { layout: () => new Map() }))).toBe(g);
  });
});
