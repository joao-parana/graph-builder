import { describe, expect, it } from 'vitest';
import { exportJson, exportPrompt, importJson, validate } from '../../src/application/index.ts';
import { validateGraph } from '../../src/domain/index.ts';
import { landingPage } from '../domain/fixtures.ts';
import { context, jsonCodec, namesRenderer } from './fakes.ts';

describe('validate (FR-20)', () => {
  it('repassa as regras do domínio', () => {
    const g = { ...landingPage(), objective: '' };
    expect(validate(g)).toEqual(validateGraph(g));
  });
});

describe('exportPrompt (FR-21)', () => {
  it('sem erros devolve o prompt do renderer', () => {
    expect(exportPrompt(landingPage(), namesRenderer)).toEqual({
      ok: true,
      value: 'in > w1 > m1 > s1 > d1 > w2 > e1',
    });
  });

  it('com erros devolve só os erros (alertas não bloqueiam)', () => {
    const g = { ...landingPage(), objective: '' };
    const g2 = {
      ...g,
      nodes: g.nodes.map((n) => (n.id === 'w1' ? { ...n, instructions: '' } : n)),
    };
    const result = exportPrompt(g2, namesRenderer);
    expect(result.ok ? [] : result.error.map((i) => i.rule)).toEqual(['VAL-01']);
  });
});

describe('exportJson / importJson (FR-21, FR-22)', () => {
  it('ida e volta: mesmo conteúdo, id novo e updatedAt = now', () => {
    const g = landingPage();
    const result = importJson(context(), exportJson(g, jsonCodec), jsonCodec);
    expect(result).toEqual({
      ok: true,
      value: { ...g, id: 'id-1', updatedAt: '2026-11-18T00:00:00.000Z' },
    });
  });

  it('erro de leitura vem do codec, com o caminho', () => {
    expect(importJson(context(), '{', jsonCodec)).toEqual({
      ok: false,
      error: { kind: 'codec', issues: [{ path: '$', message: 'JSON inválido' }] },
    });
  });

  it('grafo que viola invariante é recusado', () => {
    const g = landingPage();
    const broken = { ...g, edges: [...g.edges, { ...g.edges[0], id: 'dup' }] };
    const result = importJson(context(), JSON.stringify(broken), jsonCodec);
    expect(result.ok ? undefined : result.error).toMatchObject({
      kind: 'invariants',
      errors: [{ code: 'INV-04' }],
    });
  });
});
