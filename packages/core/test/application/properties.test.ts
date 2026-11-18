// Propriedades dos casos de uso: comandos aleatórios nunca produzem grafo inválido, e
// desfazer tudo/refazer tudo volta aos mesmos snapshots.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addNode,
  connectNodes,
  createGraph,
  deleteNode,
  duplicateNode,
  type EditContext,
  type EditResult,
  moveNode,
  record,
  redo,
  startHistory,
  toggleBarPreset,
  undo,
  updateNode,
} from '../../src/application/index.ts';
import { BAR_PRESET_IDS, checkGraph, type Graph, NodeKind } from '../../src/domain/index.ts';
import { context } from './fakes.ts';

type Step = (ctx: EditContext, g: Graph) => EditResult;

const pick = (g: Graph, i: number) => g.nodes[i % Math.max(g.nodes.length, 1)]?.id;

const step: fc.Arbitrary<Step> = fc.oneof(
  fc
    .record({ kind: fc.constantFrom(...Object.values(NodeKind)), x: fc.nat(500), y: fc.nat(500) })
    .map(
      ({ kind, x, y }): Step =>
        (ctx, g) =>
          addNode(ctx, g, { kind, position: { x, y } }),
    ),
  fc.tuple(fc.nat(), fc.nat()).map(([i, j]): Step => (ctx, g) => {
    const source = pick(g, i);
    const target = pick(g, j);
    return source && target ? connectNodes(ctx, g, { source, target }) : { ok: true, value: g };
  }),
  fc.nat().map((i): Step => (ctx, g) => {
    const nid = pick(g, i);
    return nid ? deleteNode(ctx, g, nid) : { ok: true, value: g };
  }),
  fc.nat().map((i): Step => (ctx, g) => {
    const nid = pick(g, i);
    return nid ? duplicateNode(ctx, g, nid) : { ok: true, value: g };
  }),
  fc.tuple(fc.nat(), fc.string({ maxLength: 90 })).map(([i, name]): Step => (ctx, g) => {
    const nid = pick(g, i);
    return nid ? updateNode(ctx, g, nid, { name }) : { ok: true, value: g };
  }),
  fc.tuple(fc.nat(), fc.integer({ min: -2, max: 12 })).map(([i, maxRounds]): Step => (ctx, g) => {
    const nid = pick(g, i);
    return nid ? updateNode(ctx, g, nid, { maxRounds }) : { ok: true, value: g };
  }),
  fc.tuple(fc.nat(), fc.constantFrom(...BAR_PRESET_IDS)).map(([i, preset]): Step => (ctx, g) => {
    const nid = pick(g, i);
    return nid ? toggleBarPreset(ctx, g, nid, preset) : { ok: true, value: g };
  }),
  fc
    .tuple(fc.nat(), fc.integer(), fc.integer(), fc.boolean())
    .map(([i, x, y, snap]): Step => (ctx, g) => {
      const nid = pick(g, i);
      return nid ? moveNode(ctx, g, nid, { x, y }, { snap }) : { ok: true, value: g };
    }),
);

describe('propriedades dos casos de uso', () => {
  it('nenhuma sequência de comandos aceitos produz grafo inválido; undo/redo é exato', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 50 }), (steps) => {
        const ctx = context();
        let h = startHistory(createGraph(ctx));
        const snapshots = [h.present];
        for (const run of steps) {
          const result = run(ctx, h.present);
          if (!result.ok) continue;
          expect(checkGraph(result.value)).toEqual([]);
          const before = h;
          h = record(h, result.value);
          if (h !== before) snapshots.push(h.present);
        }
        expect(h.past.length + 1).toBe(snapshots.length);
        for (let i = snapshots.length - 1; i > 0; i--) {
          expect(h.present).toBe(snapshots[i]);
          h = undo(h);
        }
        expect(h.present).toBe(snapshots[0]);
        for (let i = 1; i < snapshots.length; i++) h = redo(h);
        expect(h.present).toBe(snapshots.at(-1));
      }),
    );
  });
});
