import { describe, expect, it } from 'vitest';
import {
  addPresetLine,
  BAR_PRESET_IDS,
  BAR_PRESET_TEXT,
  checkGraph,
  checkGraphName,
  NODE_KIND_LABEL,
  nextNodeName,
  NodeKind,
  removePresetLine,
} from '../../src/domain/index.ts';
import { graph, node } from './fixtures.ts';

describe('nextNodeName (FR-01)', () => {
  it('começa em 1 e usa o rótulo pt-BR do tipo', () => {
    expect(Object.values(NodeKind).map((k) => nextNodeName(graph([]), k))).toEqual([
      'Entrada 1',
      'Trabalhador 1',
      'Supervisor 1',
      'Entrega 1',
      'Decisão 1',
      'Memória 1',
    ]);
    expect(NODE_KIND_LABEL[NodeKind.Decision]).toBe('Decisão');
  });

  it('pula números usados, sem diferença de caixa, e ignora outros nomes', () => {
    const g = graph([
      node(NodeKind.Worker, 'a', { name: 'trabalhador 1' }),
      node(NodeKind.Worker, 'b', { name: ' Trabalhador 2 ' }),
      node(NodeKind.Worker, 'c', { name: 'Trabalhador 4' }),
      node(NodeKind.Worker, 'd', { name: 'Trabalhador 3b' }),
      node(NodeKind.Decision, 'e', { name: 'DECISÃO 1' }),
    ]);
    expect(nextNodeName(g, NodeKind.Worker)).toBe('Trabalhador 3');
    expect(nextNodeName(g, NodeKind.Decision)).toBe('Decisão 2');
  });
});

describe('presets da barra (Q6)', () => {
  it('há 4 presets, todos com texto', () => {
    expect(BAR_PRESET_IDS).toEqual(['wow', 'no-errors', 'concrete-evidence', 'explicit-audience']);
    for (const p of BAR_PRESET_IDS) expect(BAR_PRESET_TEXT[p].length).toBeGreaterThan(0);
  });

  it('ligar põe uma linha no fim, sem linha em branco extra', () => {
    expect(addPresetLine('', 'T')).toBe('T');
    expect(addPresetLine('  \n', 'T')).toBe('T');
    expect(addPresetLine('A\n\n', 'T')).toBe('A\nT');
  });

  it('desligar tira só a linha exata; linha editada fica', () => {
    expect(removePresetLine('A\nT\nB', 'T')).toBe('A\nB');
    expect(removePresetLine('A\n T \nT', 'T')).toBe('A\nT');
    expect(removePresetLine('A\nT editado', 'T')).toBe('A\nT editado');
  });
});

describe('INV-09 — nome do grafo', () => {
  it('rejeita vazio e longo; aceita 80', () => {
    expect(checkGraphName(' ')).toEqual({
      ok: false,
      error: { code: 'INV-09', nodeIds: [], edgeIds: [], reason: 'empty' },
    });
    expect(checkGraphName('x'.repeat(81)).ok).toBe(false);
    expect(checkGraphName('x'.repeat(80)).ok).toBe(true);
  });

  it('checkGraph acusa nome do grafo inválido', () => {
    expect(checkGraph({ ...graph([]), name: '' }).map((e) => e.code)).toEqual(['INV-09']);
  });
});
