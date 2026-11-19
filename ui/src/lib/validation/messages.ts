// Texto dos itens "Antes de exportar" (FR-20): o domínio dá regra e parâmetros, o i18n dá a frase.
import type { ValidationIssue } from '@graph-builder/core';
import { ptBR } from '#lib/i18n/pt-BR.ts';

export const issueMessage = (issue: ValidationIssue): string =>
  ptBR.validation.rule[issue.rule](issue.params);

/** FR-20: os 5 primeiros e quantos ficaram de fora. */
export const VISIBLE_ISSUES = 5;

export function visibleIssues(issues: readonly ValidationIssue[]): {
  readonly shown: readonly ValidationIssue[];
  readonly hidden: number;
} {
  return {
    shown: issues.slice(0, VISIBLE_ISSUES),
    hidden: Math.max(0, issues.length - VISIBLE_ISSUES),
  };
}

/** Peças citadas em algum item: ganham o contorno amarelo no canvas (M1). */
export const flaggedNodeIds = (issues: readonly ValidationIssue[]): readonly string[] => [
  ...new Set(issues.flatMap((issue) => issue.nodeIds)),
];
