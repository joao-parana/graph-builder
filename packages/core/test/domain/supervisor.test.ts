import { describe, expect, it } from 'vitest';
import {
  hasReturnAnchor,
  judgedSources,
  NodeKind,
  nodeId,
  returnLinks,
  supervisorBuilders,
} from '../../src/domain/index.ts';
import { graph, ids, landingPage, node } from './fixtures.ts';

const id = nodeId;
const W = NodeKind.Worker;
const S = NodeKind.Supervisor;

describe('ponto dourado (Q1)', () => {
  it.each([
    [NodeKind.Worker, true],
    [NodeKind.Delivery, true],
    [NodeKind.Input, false],
    [NodeKind.Supervisor, false],
    [NodeKind.Decision, false],
    [NodeKind.Memory, false],
  ])('%s → %s', (kind, expected) => {
    expect(hasReturnAnchor(kind)).toBe(expected);
  });
});

describe('supervisorBuilders (§3.3, Q3)', () => {
  it('devolve ao Trabalhador que produziu o artefato', () => {
    expect(supervisorBuilders(landingPage(), id('s1'))).toEqual(['w1']);
  });

  it('julga Entrega e vários construtores, na ordem das peças, sem repetir', () => {
    const g = graph(
      [node(NodeKind.Delivery, 'e'), node(W, 'w2'), node(W, 'w1'), node(S, 's')],
      [
        ['w1', 's'],
        ['e', 's'],
        ['w2', 's'],
      ],
    );
    expect(supervisorBuilders(g, id('s'))).toEqual(['e', 'w2', 'w1']);
  });

  it('em série, devolve aos construtores do Supervisor anterior', () => {
    const g = graph(
      [node(W, 'w1'), node(W, 'w2'), node(S, 's1'), node(S, 's2')],
      [
        ['w1', 's1'],
        ['s1', 's2'],
        ['w2', 's2'],
      ],
    );
    expect(supervisorBuilders(g, id('s2'))).toEqual(['w1', 'w2']);
    expect(judgedSources(g, id('s2')).map((n) => n.id)).toEqual(['s1', 'w2']);
  });

  it('não julga Entrada, Decisão (Condition) nem Memória (MemoryRead)', () => {
    const g = graph(
      [
        node(NodeKind.Input, 'in'),
        node(NodeKind.Decision, 'd'),
        node(NodeKind.Memory, 'm'),
        node(S, 's'),
      ],
      [
        ['in', 's'],
        ['d', 's'],
        ['m', 's'],
      ],
    );
    expect(judgedSources(g, id('s'))).toEqual([]);
    expect(supervisorBuilders(g, id('s'))).toEqual([]);
  });

  it('termina mesmo num grafo inválido com ciclo de Supervisores', () => {
    const g = graph(
      [node(W, 'w'), node(S, 'a'), node(S, 'b')],
      [
        ['w', 'a'],
        ['a', 'b'],
        ['b', 'a'],
        ['x', 'a'],
      ],
    );
    expect(supervisorBuilders(g, id('a'))).toEqual(['w']);
  });

  it('returnLinks lista os retornos de todos os Supervisores', () => {
    const g = graph(
      [node(W, 'w1'), node(S, 's1'), node(S, 's2'), node(S, 's3')],
      [
        ['w1', 's1'],
        ['s1', 's2'],
      ],
    );
    expect(returnLinks(g)).toEqual([
      { supervisorId: 's1', builderId: 'w1' },
      { supervisorId: 's2', builderId: 'w1' },
    ]);
    expect(ids(g.nodes)).toContain('s3');
  });
});
