import { describe, expect, it } from 'vitest';
import {
  addNode,
  connectNodes,
  createGraph,
  type EditResult,
  type Graph,
  NodeKind,
  nodeId,
} from '@graph-builder/core';
import { testContext } from '#lib/state/test-context.ts';
import { connectionsOf, summaryOf } from './connections.ts';

const must = (result: EditResult): Graph => {
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
};

/** id2 Entrada, id3 Trabalhador, id4 Supervisor, id5 Decisão, id6 Entrega, id7 Entrega, id8 Memória. */
function sample(): Graph {
  const ctx = testContext();
  let g = createGraph(ctx);
  const kinds: [NodeKind, number, number][] = [
    [NodeKind.Input, 0, 0],
    [NodeKind.Worker, 240, 0],
    [NodeKind.Supervisor, 480, 0],
    [NodeKind.Decision, 720, 0],
    [NodeKind.Delivery, 960, 200],
    [NodeKind.Delivery, 960, 0],
    [NodeKind.Memory, 240, 300],
  ];
  for (const [kind, x, y] of kinds) g = must(addNode(ctx, g, { kind, position: { x, y } }));
  for (const [s, t] of [
    ['id2', 'id3'],
    ['id3', 'id4'],
    ['id4', 'id5'],
    ['id5', 'id6'],
    ['id5', 'id7'],
    ['id3', 'id8'],
    ['id8', 'id7'],
  ] as const) {
    g = must(connectNodes(ctx, g, { source: nodeId(s), target: nodeId(t) }));
  }
  return g;
}

const names = (nodes: readonly { name: string }[]) => nodes.map((n) => n.name);

describe('connectionsOf (FR-11, FR-13, FR-14)', () => {
  it('Trabalhador: recebe, envia, escreve', () => {
    const c = connectionsOf(sample(), nodeId('id3'));
    expect(names(c.receivesFrom)).toEqual(['Entrada 1']);
    expect(names(c.sendsTo)).toEqual(['Supervisor 1']);
    expect(names(c.writesTo)).toEqual(['Memória 1']);
    expect(c.readsFrom).toEqual([]);
  });

  it('Supervisor julga o Trabalhador, não a Entrada', () => {
    const c = connectionsOf(sample(), nodeId('id4'));
    expect(names(c.judges)).toEqual(['Trabalhador 1']);
    expect(names(c.sendsTo)).toEqual(['Decisão 1']);
  });

  it('Decisão: caminhos na ordem topológica do destino', () => {
    const c = connectionsOf(sample(), nodeId('id5'));
    expect(c.paths.map((p) => p.target.name)).toEqual(['Entrega 2', 'Entrega 1']);
    expect(c.sendsTo).toEqual([]);
  });

  it('Memória: quem escreve e quem consulta', () => {
    const c = connectionsOf(sample(), nodeId('id8'));
    expect(names(c.writers)).toEqual(['Trabalhador 1']);
    expect(names(c.readers)).toEqual(['Entrega 2']);
  });

  it('Entrega: consulta a Memória e recebe da Decisão', () => {
    const c = connectionsOf(sample(), nodeId('id7'));
    expect(names(c.receivesFrom)).toEqual(['Decisão 1']);
    expect(names(c.readsFrom)).toEqual(['Memória 1']);
  });
});

describe('summaryOf (FR-10)', () => {
  it('conta peças por tipo, fios e laços de retorno', () => {
    expect(summaryOf(sample())).toEqual({
      counts: { input: 1, worker: 1, supervisor: 1, decision: 1, delivery: 2, memory: 1 },
      wires: 7,
      loops: 1,
    });
  });
});
