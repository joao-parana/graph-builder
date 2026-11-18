import { DOMAIN_LAYER } from '@graph-builder/core';
import { describe, expect, it } from 'vitest';
import { ptBR } from './pt-BR.ts';

describe('ui (scaffold L00)', () => {
  it('tem textos em pt-BR', () => {
    expect(ptBR.app.tagline).toBe('Editor visual de grafos de agentes');
  });

  it('resolve o workspace @graph-builder/core', () => {
    expect(DOMAIN_LAYER).toBe('domain');
  });
});
