// Derivação do tipo de fio pelos tipos das pontas (SPEC §3.2).
import { EdgeKind, NodeKind } from './model.ts';

/** `undefined` quando a ligação é proibida (Memória → Memória, INV-05). */
export function deriveEdgeKind(source: NodeKind, target: NodeKind): EdgeKind | undefined {
  if (source === NodeKind.Memory) {
    return target === NodeKind.Memory ? undefined : EdgeKind.MemoryRead;
  }
  if (target === NodeKind.Memory) return EdgeKind.MemoryWrite;
  return source === NodeKind.Decision ? EdgeKind.Condition : EdgeKind.Flow;
}

/** Fios que definem a sequência de execução (topo sort, INV-06, VAL-10). */
export const isSequenceKind = (kind: EdgeKind): boolean =>
  kind === EdgeKind.Flow || kind === EdgeKind.Condition;
