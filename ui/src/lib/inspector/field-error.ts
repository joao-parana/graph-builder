// Motivo de recusa embaixo do campo (FR-10): o nome diz o problema exato; o resto usa o toast.
import type { DomainError } from '@graph-builder/core';
import { ptBR } from '#lib/i18n/pt-BR.ts';

export function fieldError(error: DomainError | null): string | null {
  if (error === null) return null;
  if (error.reason !== undefined) return ptBR.inspector.nameProblem[error.reason];
  if (error.code === 'INV-08') return ptBR.inspector.maxRoundsProblem;
  return ptBR.errors[error.code];
}
