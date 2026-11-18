import { describe, expect, it } from 'vitest';
import {
  canAddNode,
  canConnect,
  checkGraph,
  checkNodeName,
  EdgeKind,
  isValidMaxRounds,
  nameShapeProblem,
  NodeKind,
  nodeId,
} from '../../src/domain/index.ts';
import { graph, landingPage, node } from './fixtures.ts';

const id = nodeId;
const codes = (errors: readonly { code: string }[]) => errors.map((e) => e.code);

describe('INV-01 — uma Entrada por grafo', () => {
  it('aceita a primeira Entrada e qualquer outro tipo', () => {
    expect(canAddNode(graph([]), NodeKind.Input).ok).toBe(true);
    expect(canAddNode(landingPage(), NodeKind.Worker).ok).toBe(true);
  });

  it('rejeita a segunda Entrada', () => {
    const result = canAddNode(landingPage(), NodeKind.Input);
    expect(result).toEqual({
      ok: false,
      error: { code: 'INV-01', nodeIds: ['in'], edgeIds: [] },
    });
  });

  it('checkGraph acusa duas Entradas', () => {
    const g = graph([node(NodeKind.Input, 'a'), node(NodeKind.Input, 'b')]);
    expect(checkGraph(g)).toEqual([{ code: 'INV-01', nodeIds: ['a', 'b'], edgeIds: [] }]);
  });
});

describe('canConnect — INV-02..06', () => {
  const g = landingPage();

  it('devolve o tipo derivado quando a ligação é válida', () => {
    expect(canConnect(g, id('w1'), id('e1'))).toEqual({ ok: true, value: EdgeKind.Flow });
    const fork = graph([node(NodeKind.Decision, 'd'), node(NodeKind.Supervisor, 's')]);
    expect(canConnect(fork, id('d'), id('s'))).toEqual({ ok: true, value: EdgeKind.Condition });
    expect(canConnect(g, id('m1'), id('e1'))).toEqual({ ok: true, value: EdgeKind.MemoryRead });
    expect(canConnect(g, id('e1'), id('m1'))).toEqual({ ok: true, value: EdgeKind.MemoryWrite });
  });

  it.each([
    ['peça inexistente na origem', 'x', 'w1', 'NODE_NOT_FOUND'],
    ['peça inexistente no destino', 'w1', 'x', 'NODE_NOT_FOUND'],
    ['INV-03 auto-ligação', 'w1', 'w1', 'INV-03'],
    ['INV-02 Entrada não recebe fios', 'w1', 'in', 'INV-02'],
    ['INV-02 nem de Memória', 'm1', 'in', 'INV-02'],
    ['INV-04 fio duplicado', 'w1', 's1', 'INV-04'],
    ['INV-06 ciclo direto', 's1', 'w1', 'INV-06'],
    ['INV-02 tem prioridade sobre INV-06', 'e1', 'in', 'INV-02'],
    ['INV-06 ciclo via Decisão', 'e1', 'w1', 'INV-06'],
  ])('%s', (_label, source, target, code) => {
    const result = canConnect(g, id(source), id(target));
    expect(result.ok ? undefined : result.error.code).toBe(code);
  });

  it('INV-05 Memória → Memória', () => {
    const g2 = graph([node(NodeKind.Memory, 'm1'), node(NodeKind.Memory, 'm2')]);
    const result = canConnect(g2, id('m1'), id('m2'));
    expect(result.ok ? undefined : result.error).toEqual({
      code: 'INV-05',
      nodeIds: ['m1', 'm2'],
      edgeIds: [],
    });
  });

  it('INV-04 informa o fio já existente', () => {
    const result = canConnect(g, id('w1'), id('s1'));
    expect(result.ok ? undefined : result.error.edgeIds).toEqual(['w1->s1']);
  });

  it('fios de Memória não contam como ciclo (INV-06)', () => {
    // e1 → m1 e m1 → w1 fecham um "laço" só por Memória: permitido.
    const g2 = graph(
      [node(NodeKind.Worker, 'w1'), node(NodeKind.Delivery, 'e1'), node(NodeKind.Memory, 'm1')],
      [
        ['w1', 'e1'],
        ['e1', 'm1'],
      ],
    );
    expect(canConnect(g2, id('m1'), id('w1')).ok).toBe(true);
  });

  it('o sentido inverso de um fio de Memória existente não é duplicado', () => {
    expect(canConnect(g, id('m1'), id('w1')).ok).toBe(true);
  });
});

describe('INV-07 — nomes', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['a'.repeat(81), 'too-long'],
  ])('%j → %s', (name, problem) => {
    expect(nameShapeProblem(name)).toBe(problem);
  });

  it('aceita 80 caracteres e conta grafemas, não unidades UTF-16', () => {
    expect(nameShapeProblem('a'.repeat(80))).toBeUndefined();
    expect(nameShapeProblem('👩‍💻'.repeat(80))).toBeUndefined();
    expect(nameShapeProblem('ç'.repeat(80))).toBeUndefined();
  });

  it('rejeita nome duplicado sem diferença de caixa nem espaços nas pontas', () => {
    const g = graph([node(NodeKind.Worker, 'w1', { name: 'Redator' })]);
    const result = checkNodeName(g, '  REDATOR ');
    expect(result).toEqual({
      ok: false,
      error: { code: 'INV-07', nodeIds: ['w1'], edgeIds: [], reason: 'duplicate' },
    });
  });

  it('permite manter o próprio nome ao renomear', () => {
    const g = graph([node(NodeKind.Worker, 'w1', { name: 'Redator' })]);
    expect(checkNodeName(g, 'redator', id('w1')).ok).toBe(true);
  });

  it('informa a peça renomeada e a peça em conflito', () => {
    const g = graph([node(NodeKind.Worker, 'a', { name: 'A' }), node(NodeKind.Worker, 'b')]);
    const result = checkNodeName(g, 'a', id('b'));
    expect(result.ok ? undefined : result.error.nodeIds).toEqual(['b', 'a']);
  });

  it('rejeita nome vazio com o motivo', () => {
    const result = checkNodeName(graph([]), ' ', id('w1'));
    expect(result.ok ? undefined : result.error).toEqual({
      code: 'INV-07',
      nodeIds: ['w1'],
      edgeIds: [],
      reason: 'empty',
    });
  });

  it('aceita nome novo e único', () => {
    expect(checkNodeName(landingPage(), 'Trabalhador 3').ok).toBe(true);
  });
});

describe('INV-08 — maxRounds', () => {
  it.each([1, 3, 10])('%d é válido', (n) => {
    expect(isValidMaxRounds(n)).toBe(true);
  });
  it.each([0, 11, 2.5, Number.NaN, -1])('%d é inválido', (n) => {
    expect(isValidMaxRounds(n)).toBe(false);
  });
});

describe('checkGraph', () => {
  it('o exemplo do SPEC §6 é válido', () => {
    expect(checkGraph(landingPage())).toEqual([]);
  });

  it('acusa cada violação de fio', () => {
    const nodes = [
      node(NodeKind.Input, 'in'),
      node(NodeKind.Worker, 'w1'),
      node(NodeKind.Memory, 'm1'),
      node(NodeKind.Memory, 'm2'),
    ];
    const g = graph(nodes, [
      ['w1', 'in'],
      ['m1', 'm2'],
      ['w1', 'm1', { kind: EdgeKind.Flow }],
      ['in', 'w1'],
      ['in', 'w1', { id: 'dup' }],
      ['w1', 'x'],
    ]);
    expect(codes(checkGraph(g))).toEqual([
      'INV-02',
      'INV-05',
      'EDGE_KIND_MISMATCH',
      'INV-04',
      'NODE_NOT_FOUND',
      'INV-06',
    ]);
  });

  it('INV-03: auto-ligação também é ciclo', () => {
    const g = graph([node(NodeKind.Worker, 'w1')], [['w1', 'w1']]);
    expect(checkGraph(g)).toEqual([
      { code: 'INV-03', nodeIds: ['w1', 'w1'], edgeIds: ['w1->w1'] },
      { code: 'INV-06', nodeIds: ['w1'], edgeIds: [] },
    ]);
  });

  it('INV-06 lista só as peças do ciclo, não as de fora dele', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map((n) => node(NodeKind.Worker, n));
    const g = graph(nodes, [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'b'],
      ['c', 'd'],
      ['e', 'a'],
    ]);
    expect(checkGraph(g)).toEqual([{ code: 'INV-06', nodeIds: ['b', 'c'], edgeIds: [] }]);
  });

  it('INV-07 e INV-08 por peça', () => {
    const g = graph([
      node(NodeKind.Worker, 'a', { name: 'Igual' }),
      node(NodeKind.Worker, 'b', { name: 'igual ' }),
      node(NodeKind.Worker, 'c', { name: '' }),
      node(NodeKind.Supervisor, 's', { maxRounds: 0 }),
    ]);
    expect(checkGraph(g)).toEqual([
      { code: 'INV-07', nodeIds: ['a', 'b'], edgeIds: [], reason: 'duplicate' },
      { code: 'INV-07', nodeIds: ['c'], edgeIds: [], reason: 'empty' },
      { code: 'INV-08', nodeIds: ['s'], edgeIds: [] },
    ]);
  });
});
