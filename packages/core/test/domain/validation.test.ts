import { describe, expect, it } from 'vitest';
import {
  type Graph,
  hasBlockingErrors,
  NodeKind,
  RULE_LEVEL,
  validateGraph,
  type ValidationRule,
} from '../../src/domain/index.ts';
import { graph, landingPage, node } from './fixtures.ts';

const W = NodeKind.Worker;
const S = NodeKind.Supervisor;
const D = NodeKind.Delivery;

/** Itens de uma regra, como `[nodeIds, params]`. */
const of = (g: Graph, rule: ValidationRule) =>
  validateGraph(g)
    .filter((item) => item.rule === rule)
    .map((item) => [item.nodeIds, item.params]);

describe('validateGraph (SPEC §3.5)', () => {
  it('o exemplo do SPEC §6 não tem itens', () => {
    expect(validateGraph(landingPage())).toEqual([]);
  });

  it('o nível de cada regra segue a tabela', () => {
    const errors = Object.entries(RULE_LEVEL).filter(([, level]) => level === 'error');
    expect(errors.map(([rule]) => rule)).toEqual([
      'VAL-01',
      'VAL-03',
      'VAL-05',
      'VAL-07',
      'VAL-10',
    ]);
  });

  it('VAL-01 objetivo vazio (espaços contam como vazio)', () => {
    expect(of({ ...landingPage(), objective: '  \n' }, 'VAL-01')).toEqual([[[], {}]]);
  });

  it('VAL-02 peça sem instruções', () => {
    const g = graph([node(W, 'w', { name: 'Redator', instructions: ' ' })]);
    expect(of(g, 'VAL-02')).toEqual([[['w'], { name: 'Redator' }]]);
  });

  it('VAL-03 fio de Decisão sem condição, com os fios no item', () => {
    const g = graph(
      [node(NodeKind.Decision, 'd'), node(W, 'a'), node(W, 'b'), node(W, 'c')],
      [
        ['d', 'a', { condition: 'se sim' }],
        ['d', 'b'],
        ['d', 'c', { condition: '' }],
      ],
    );
    const [item] = validateGraph(g).filter((i) => i.rule === 'VAL-03');
    expect(item?.nodeIds).toEqual(['d']);
    expect(item?.edgeIds).toEqual(['d->b', 'd->c']);
  });

  it('VAL-04 Decisão com menos de dois caminhos', () => {
    const g = graph(
      [node(NodeKind.Decision, 'd', { name: 'Escolha' }), node(W, 'a'), node(NodeKind.Memory, 'm')],
      [
        ['d', 'a', { condition: 'sempre' }],
        ['d', 'm'],
      ],
    );
    expect(of(g, 'VAL-04')).toEqual([[['d'], { name: 'Escolha' }]]);
  });

  it('VAL-05 Supervisor sem nada para julgar; Entrada não conta', () => {
    const g = graph(
      [node(NodeKind.Input, 'in'), node(S, 's'), node(D, 'e')],
      [
        ['in', 's'],
        ['s', 'e'],
      ],
    );
    expect(of(g, 'VAL-05')).toEqual([[['s'], { name: 's' }]]);
  });

  it('VAL-06 Supervisor sem saída; escrever na Memória não é saída', () => {
    const g = graph(
      [node(W, 'w'), node(S, 's'), node(NodeKind.Memory, 'm')],
      [
        ['w', 's'],
        ['s', 'm'],
      ],
    );
    expect(of(g, 'VAL-06')).toEqual([[['s'], { name: 's' }]]);
  });

  it('VAL-07 grafo sem Entrega', () => {
    expect(of(graph([node(W, 'w')]), 'VAL-07')).toEqual([[[], {}]]);
  });

  it('VAL-08 peça solta', () => {
    const g = graph([node(W, 'w'), node(D, 'e'), node(W, 'solta')], [['w', 'e']]);
    expect(of(g, 'VAL-08')).toEqual([[['solta'], { name: 'solta' }]]);
  });

  it('VAL-09 Memória sem escrita e sem consulta', () => {
    const g = graph(
      [node(W, 'w'), node(NodeKind.Memory, 'a'), node(NodeKind.Memory, 'b')],
      [
        ['w', 'a'],
        ['b', 'w'],
      ],
    );
    expect(of(g, 'VAL-09')).toEqual([
      [['a'], { name: 'a', missing: 'read' }],
      [['b'], { name: 'b', missing: 'write' }],
    ]);
  });

  describe('VAL-10 peças inalcançáveis', () => {
    it('com Entrada, só ela é o início', () => {
      const g = graph(
        [node(NodeKind.Input, 'in'), node(W, 'w1'), node(W, 'w2'), node(D, 'e')],
        [
          ['in', 'w1'],
          ['w1', 'e'],
          ['w2', 'e'],
        ],
      );
      expect(of(g, 'VAL-10')).toEqual([[['w2'], {}]]);
    });

    it('sem Entrada, toda peça sem fio de entrada é início', () => {
      const g = graph(
        [node(W, 'w1'), node(W, 'w2'), node(D, 'e')],
        [
          ['w1', 'e'],
          ['w2', 'e'],
        ],
      );
      expect(of(g, 'VAL-10')).toEqual([]);
    });

    it('ignora peças soltas, ligadas só à Memória e a própria Memória', () => {
      const g = graph(
        [
          node(NodeKind.Input, 'in'),
          node(W, 'solta'),
          node(W, 'leitor'),
          node(NodeKind.Memory, 'm'),
        ],
        [
          ['in', 'm'],
          ['m', 'leitor'],
        ],
      );
      expect(of(g, 'VAL-10')).toEqual([]);
    });

    it('ciclo inválido sem início também é inalcançável', () => {
      const g = graph(
        [node(W, 'a'), node(W, 'b')],
        [
          ['a', 'b'],
          ['b', 'a'],
        ],
      );
      expect(of(g, 'VAL-10')).toEqual([[['a', 'b'], {}]]);
    });
  });

  it('ordena erros antes de alertas, depois por regra e pela ordem das peças', () => {
    const g = graph(
      [node(W, 'b', { instructions: '' }), node(S, 's'), node(W, 'a', { instructions: '' })],
      [],
      '',
    );
    expect(validateGraph(g).map((i) => `${i.rule}:${i.nodeIds.join(',')}`)).toEqual([
      'VAL-01:',
      'VAL-05:s',
      'VAL-07:',
      'VAL-02:b',
      'VAL-02:a',
      'VAL-06:s',
      'VAL-08:b',
      'VAL-08:s',
      'VAL-08:a',
    ]);
  });

  it('hasBlockingErrors só considera erros', () => {
    expect(hasBlockingErrors(validateGraph(landingPage()))).toBe(false);
    const onlyWarnings = graph([node(D, 'e', { instructions: '' })]);
    expect(validateGraph(onlyWarnings).map((i) => i.level)).toEqual(['warning', 'warning']);
    expect(hasBlockingErrors(validateGraph(onlyWarnings))).toBe(false);
    expect(hasBlockingErrors(validateGraph({ ...landingPage(), objective: '' }))).toBe(true);
  });
});
