// Arrastar da paleta para o canvas (FR-01): o tipo da peça viaja no DataTransfer.
import { NodeKind } from '@graph-builder/core';

export const KIND_MIME = 'application/x-graph-builder-kind';

const KINDS: ReadonlyMap<string, NodeKind> = new Map(Object.values(NodeKind).map((k) => [k, k]));

export function kindFrom(data: DataTransfer | null): NodeKind | null {
  const value = data?.getData(KIND_MIME) ?? '';
  return KINDS.get(value) ?? null;
}
