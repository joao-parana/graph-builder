import { describe, expect, it } from 'vitest';
import {
  type DomainError,
  nodeId,
  RULE_LEVEL,
  type ValidationIssue,
  type ValidationRule,
} from '@graph-builder/core';
import { fieldError } from '#lib/inspector/field-error.ts';
import { flaggedNodeIds, issueMessage, visibleIssues } from './messages.ts';

const issue = (
  rule: ValidationRule,
  params: Record<string, string> = {},
  ids: string[] = [],
): ValidationIssue => ({
  rule,
  level: RULE_LEVEL[rule],
  nodeIds: ids.map(nodeId),
  edgeIds: [],
  params,
});

describe('issueMessage (§3.5)', () => {
  it.each([
    ['VAL-01', {}, 'O grafo está sem objetivo — escreva, na direita, o que ele precisa entregar.'],
    ['VAL-02', { name: 'T1' }, '"T1" está sem instruções.'],
    ['VAL-03', { name: 'D' }, '"D" tem um fio sem condição escrita.'],
    ['VAL-04', { name: 'D' }, '"D" tem menos de dois caminhos.'],
    ['VAL-05', { name: 'S' }, '"S" não recebe nada para julgar.'],
    ['VAL-06', { name: 'S' }, '"S" não leva a lugar nenhum (sem saída).'],
    ['VAL-07', {}, 'O grafo não tem nenhuma Entrega.'],
    ['VAL-08', { name: 'X' }, '"X" está solta (sem fios).'],
    ['VAL-09', { name: 'M', missing: 'write' }, '"M" ninguém escreve nela.'],
    ['VAL-09', { name: 'M', missing: 'read' }, '"M" ninguém consulta.'],
    ['VAL-10', {}, 'Há peças inalcançáveis a partir do início (Entrada ou peças sem entrada).'],
  ] as const)('%s %j', (rule, params, text) => {
    expect(issueMessage(issue(rule, params))).toBe(text);
  });
});

describe('visibleIssues e flaggedNodeIds (FR-20)', () => {
  it('mostra 5 e conta o resto', () => {
    const many = Array.from({ length: 7 }, () => issue('VAL-07'));
    expect(visibleIssues(many)).toMatchObject({ hidden: 2 });
    expect(visibleIssues(many).shown).toHaveLength(5);
    expect(visibleIssues(many.slice(0, 3)).hidden).toBe(0);
  });

  it('peças citadas, sem repetição', () => {
    const list = [issue('VAL-02', {}, ['a']), issue('VAL-08', {}, ['a', 'b']), issue('VAL-01')];
    expect(flaggedNodeIds(list)).toEqual(['a', 'b']);
  });
});

describe('fieldError', () => {
  const error = (code: DomainError['code'], reason?: DomainError['reason']): DomainError => ({
    code,
    nodeIds: [],
    edgeIds: [],
    ...(reason === undefined ? {} : { reason }),
  });

  it.each([
    [null, null],
    [error('INV-07', 'duplicate'), 'Já existe uma peça com esse nome.'],
    [error('INV-07', 'empty'), 'O nome não pode ficar vazio.'],
    [error('INV-09', 'too-long'), 'O nome passa de 80 caracteres.'],
    [error('INV-08'), 'Use um número inteiro de 1 a 10.'],
    [error('NOT_APPLICABLE'), 'Ação não se aplica a esse item'],
  ])('%j → %s', (input, text) => {
    expect(fieldError(input)).toBe(text);
  });
});
