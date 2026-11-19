import { describe, expect, it } from 'vitest';
import { createGraph, importJson, jsonGraphCodec, type ImportError } from '@graph-builder/core';
import { testContext } from '#lib/state/test-context.ts';
import { formatUpdated } from '#lib/library/when.ts';
import { ptBR } from '#lib/i18n/pt-BR.ts';
import { fileName } from './files.ts';
import { importProblems } from './import-problems.ts';

describe('fileName (FR-21)', () => {
  it.each([
    ['Landing page', 'md', 'Landing page.md'],
    ['a/b:c*d?"e"<f>|g', 'json', 'a-b-c-d--e--f--g.json'],
    ['  ', 'md', 'grafo.md'],
    ['tab\there', 'md', 'tab-here.md'],
  ] as const)('%j → %s', (name, ext, out) => {
    expect(fileName(name, ext)).toBe(out);
  });
});

describe('importProblems (FR-22)', () => {
  const fail = (text: string): ImportError => {
    const result = importJson(testContext(), text, jsonGraphCodec);
    if (result.ok) throw new Error('devia falhar');
    return result.error;
  };

  it('erro do schema mantém o caminho', () => {
    expect(importProblems('{', fail('{'))).toEqual([
      { path: '$', message: expect.any(String) as string },
    ]);
  });

  it('invariante aponta o fio ou a peça pelo índice', () => {
    const ctx = testContext();
    const graph = createGraph(ctx);
    const node = {
      id: 'n1',
      kind: 'worker',
      name: 'T',
      instructions: '',
      position: { x: 0, y: 0 },
    };
    const loop = { id: 'e1', source: 'n1', target: 'n1', kind: 'flow' };
    const text = jsonGraphCodec.encode({ ...graph, nodes: [node], edges: [loop] } as never);
    expect(importProblems(text, fail(text))).toContainEqual({
      path: 'edges[0]',
      message: 'Uma peça não se liga a ela mesma (INV-03).',
    });
    const twins = jsonGraphCodec.encode({
      ...graph,
      nodes: [node, { ...node, id: 'n2' }],
    } as never);
    expect(importProblems(twins, fail(twins))[0]).toMatchObject({
      path: 'nodes[0]',
      message: 'Nome inválido (INV-07).',
    });
  });
});

describe('formatUpdated (FR-31)', () => {
  const now = new Date(2026, 10, 18, 15, 0);
  const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).toISOString();
  it('hoje, ontem ou a data', () => {
    expect(formatUpdated(at(18, 8, 52), now, ptBR.library)).toBe('hoje, 08:52');
    expect(formatUpdated(at(17, 17, 10), now, ptBR.library)).toBe('ontem, 17:10');
    expect(formatUpdated(at(10, 9, 0), now, ptBR.library)).toBe('10/11/2026');
  });
});
