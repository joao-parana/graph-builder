// Contexto determinístico para os testes do editor.
import type { EditContext } from '@graph-builder/core';

export function testContext(): EditContext {
  let id = 0;
  let tick = 0;
  return {
    clock: { now: () => new Date(Date.UTC(2026, 10, 18, 0, 0, (tick += 1))).toISOString() },
    ids: { next: () => `id${String((id += 1))}` },
  };
}
