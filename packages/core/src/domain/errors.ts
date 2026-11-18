// Erros de domínio: comandos que violariam uma invariante (SPEC §3.4) são rejeitados.
import type { EdgeId, NodeId } from './ids.ts';

export type InvariantCode =
  'INV-01' | 'INV-02' | 'INV-03' | 'INV-04' | 'INV-05' | 'INV-06' | 'INV-07' | 'INV-08';

/** Além das invariantes: referência a peça inexistente e tipo de fio diferente do derivado (§3.2). */
export type DomainErrorCode = InvariantCode | 'NODE_NOT_FOUND' | 'EDGE_KIND_MISMATCH';

/** Detalhe do INV-07. */
export type NameProblem = 'empty' | 'too-long' | 'duplicate';

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly nodeIds: readonly NodeId[];
  readonly edgeIds: readonly EdgeId[];
  readonly reason?: NameProblem;
}

export const domainError = (
  code: DomainErrorCode,
  refs: { nodeIds?: readonly NodeId[]; edgeIds?: readonly EdgeId[]; reason?: NameProblem } = {},
): DomainError => ({
  code,
  nodeIds: refs.nodeIds ?? [],
  edgeIds: refs.edgeIds ?? [],
  ...(refs.reason === undefined ? {} : { reason: refs.reason }),
});
