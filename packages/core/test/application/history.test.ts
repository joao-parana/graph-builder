import { describe, expect, it } from 'vitest';
import {
  amend,
  canRedo,
  canUndo,
  HISTORY_LIMIT,
  record,
  redo,
  startHistory,
  undo,
} from '../../src/application/index.ts';
import type { Graph } from '../../src/domain/index.ts';
import { graph } from '../domain/fixtures.ts';

const version = (n: number): Graph => ({ ...graph([]), name: `v${String(n)}` });

describe('histórico (FR-08)', () => {
  it('desfaz e refaz na ordem', () => {
    let h = startHistory(version(0));
    h = record(h, version(1));
    h = record(h, version(2));
    h = undo(h);
    expect(h.present.name).toBe('v1');
    h = undo(h);
    expect(h.present.name).toBe('v0');
    expect(canUndo(h)).toBe(false);
    h = redo(redo(h));
    expect(h.present.name).toBe('v2');
    expect(canRedo(h)).toBe(false);
  });

  it('desfazer/refazer sem passos não muda nada', () => {
    const h = startHistory(version(0));
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('um comando novo apaga o que dava para refazer', () => {
    let h = record(startHistory(version(0)), version(1));
    h = record(undo(h), version(2));
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present.name).toBe('v0');
  });

  it('o mesmo objeto (comando sem mudança) não entra', () => {
    const h = startHistory(version(0));
    expect(record(h, h.present)).toBe(h);
  });

  it(`guarda os últimos ${String(HISTORY_LIMIT)} passos`, () => {
    let h = startHistory(version(0));
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) h = record(h, version(i));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]?.name).toBe('v5');
  });
});

describe('amend (FR-08, L05)', () => {
  it('junta edições num passo só: um desfazer volta ao antes da 1ª', () => {
    let h = startHistory(version(0));
    h = record(h, version(1)); // 1ª tecla abre o passo
    h = amend(h, version(2));
    h = amend(h, version(3));
    expect(h.present.name).toBe('v3');
    expect(h.past.map((g) => g.name)).toEqual(['v0']);
    h = undo(h);
    expect(h.present.name).toBe('v0');
    expect(h.future.map((g) => g.name)).toEqual(['v3']);
  });

  it('mesmo objeto não muda nada; grafo novo descarta o refazer', () => {
    let h = record(startHistory(version(0)), version(1));
    h = undo(h);
    expect(amend(h, h.present)).toBe(h);
    h = amend(h, version(9));
    expect(canRedo(h)).toBe(false);
    expect(h.past).toEqual([]);
  });
});
