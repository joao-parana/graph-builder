import { describe, expect, it } from 'vitest';
import { deriveEdgeKind, EdgeKind, isSequenceKind, NodeKind } from '../../src/domain/index.ts';

const ALL = Object.values(NodeKind);
const OTHERS = ALL.filter((k) => k !== NodeKind.Memory && k !== NodeKind.Decision);

describe('deriveEdgeKind (SPEC §3.2)', () => {
  it('Memória → Memória é proibido', () => {
    expect(deriveEdgeKind(NodeKind.Memory, NodeKind.Memory)).toBeUndefined();
  });

  it.each(ALL.filter((k) => k !== NodeKind.Memory))('Memória → %s é MemoryRead', (target) => {
    expect(deriveEdgeKind(NodeKind.Memory, target)).toBe(EdgeKind.MemoryRead);
  });

  it.each(ALL.filter((k) => k !== NodeKind.Memory))('%s → Memória é MemoryWrite', (source) => {
    expect(deriveEdgeKind(source, NodeKind.Memory)).toBe(EdgeKind.MemoryWrite);
  });

  it.each(ALL.filter((k) => k !== NodeKind.Memory))('Decisão → %s é Condition', (target) => {
    expect(deriveEdgeKind(NodeKind.Decision, target)).toBe(EdgeKind.Condition);
  });

  it.each(OTHERS.flatMap((s) => ALL.filter((t) => t !== NodeKind.Memory).map((t) => [s, t])))(
    '%s → %s é Flow',
    (source, target) => {
      expect(deriveEdgeKind(source, target)).toBe(EdgeKind.Flow);
    },
  );

  it('só Flow e Condition definem a sequência', () => {
    expect(Object.values(EdgeKind).filter(isSequenceKind)).toEqual([
      EdgeKind.Flow,
      EdgeKind.Condition,
    ]);
  });
});
