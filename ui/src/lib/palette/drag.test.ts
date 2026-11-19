import { describe, expect, it } from 'vitest';
import { NodeKind } from '@graph-builder/core';
import { KIND_MIME, kindFrom } from './drag.ts';

const transfer = (data: Record<string, string>) =>
  ({ getData: (type: string) => data[type] ?? '' }) as unknown as DataTransfer;

describe('kindFrom', () => {
  it('lê o tipo da peça arrastada da paleta', () => {
    expect(kindFrom(transfer({ [KIND_MIME]: 'worker' }))).toBe(NodeKind.Worker);
  });

  it('ignora outro conteúdo arrastado', () => {
    expect(kindFrom(transfer({ [KIND_MIME]: 'robô' }))).toBeNull();
    expect(kindFrom(transfer({ 'text/plain': 'worker' }))).toBeNull();
    expect(kindFrom(null)).toBeNull();
  });
});
