// Contrato do GraphRepository (SPEC §7.1, §10): os mesmos casos no IndexedDB e no Supabase local.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { type GraphRepository, listGraphs } from '../../src/application/index.ts';
import { type Graph, graphId } from '../../src/domain/index.ts';
import {
  IndexedDbGraphRepository,
  SupabaseGraphRepository,
} from '../../src/infrastructure/index.ts';
import { graph, landingPage } from '../domain/fixtures.ts';
import { createTestUser, local } from './supabase-local.ts';

const named = (id: string, name: string, updatedAt: string): Graph => ({
  ...graph([]),
  id: graphId(id),
  name,
  updatedAt,
});

interface Subject {
  readonly name: string;
  readonly skip: boolean;
  fresh(): Promise<GraphRepository>;
}

let cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.map((cleanup) => cleanup()));
  cleanups = [];
});

let dbCount = 0;
const subjects: Subject[] = [
  {
    name: 'IndexedDbGraphRepository',
    skip: false,
    fresh: () =>
      Promise.resolve(new IndexedDbGraphRepository(`contrato-${String((dbCount += 1))}`)),
  },
  {
    name: 'SupabaseGraphRepository (Supabase local)',
    skip: local === null,
    fresh: async () => {
      if (local === null) throw new Error('Supabase local fora do ar');
      const user = await createTestUser(local);
      cleanups.push(() => user.remove());
      return new SupabaseGraphRepository(user.client);
    },
  },
];

describe.each(subjects)('contrato do GraphRepository: $name', (subject) => {
  const test = it.skipIf(subject.skip);

  test('vazio: lista vazia e get → null', async () => {
    const repo = await subject.fresh();
    expect(await repo.list()).toEqual([]);
    expect(await repo.get(graphId('nada'))).toBeNull();
  });

  test('save → get devolve o mesmo grafo', async () => {
    const repo = await subject.fresh();
    const g = landingPage();
    await repo.save(g);
    expect(await repo.get(g.id)).toEqual(g);
  });

  test('save com o mesmo id sobrescreve; list resume (FR-31)', async () => {
    const repo = await subject.fresh();
    await repo.save(named('a', 'Primeiro', '2026-11-18T00:00:00.000Z'));
    await repo.save(named('a', 'Renomeado', '2026-11-18T01:00:00.000Z'));
    await repo.save(landingPage());
    const summaries = [...(await repo.list())].sort((x, y) => x.id.localeCompare(y.id));
    expect(summaries).toEqual([
      { id: 'a', name: 'Renomeado', nodeCount: 0, updatedAt: '2026-11-18T01:00:00.000Z' },
      { id: 'g1', name: 'Meu grafo', nodeCount: 7, updatedAt: '2026-11-18T00:00:00.000Z' },
    ]);
  });

  test('delete remove só o grafo pedido; id inexistente não falha', async () => {
    const repo = await subject.fresh();
    await repo.save(named('a', 'A', '2026-11-18T00:00:00.000Z'));
    await repo.save(named('b', 'B', '2026-11-18T00:00:00.000Z'));
    await repo.delete(graphId('a'));
    await repo.delete(graphId('inexistente'));
    expect(await repo.get(graphId('a'))).toBeNull();
    expect((await repo.list()).map((s) => s.id)).toEqual(['b']);
  });

  test('funciona com o ListGraphs (mais recente primeiro)', async () => {
    const repo = await subject.fresh();
    await repo.save(named('velho', 'Velho', '2026-11-01T00:00:00.000Z'));
    await repo.save(named('novo', 'Novo', '2026-11-18T00:00:00.000Z'));
    expect((await listGraphs(repo)).map((s) => s.id)).toEqual(['novo', 'velho']);
  });
});
