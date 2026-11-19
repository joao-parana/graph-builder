import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { listGraphs } from '../../src/application/index.ts';
import { type Graph, graphId } from '../../src/domain/index.ts';
import { IndexedDbGraphRepository } from '../../src/infrastructure/indexeddb-repository.ts';
import { graph, landingPage } from '../domain/fixtures.ts';

let dbCount = 0;
/** Banco novo por teste: os testes não se enxergam. */
const freshRepository = () => new IndexedDbGraphRepository(`test-${String((dbCount += 1))}`);

const named = (id: string, name: string, updatedAt: string): Graph => ({
  ...graph([]),
  id: graphId(id),
  name,
  updatedAt,
});

describe('IndexedDbGraphRepository', () => {
  it('banco vazio: lista vazia e get → null', async () => {
    const repo = freshRepository();
    expect(await repo.list()).toEqual([]);
    expect(await repo.get(graphId('nada'))).toBeNull();
  });

  it('save → get devolve o mesmo grafo', async () => {
    const repo = freshRepository();
    const g = landingPage();
    await repo.save(g);
    expect(await repo.get(g.id)).toEqual(g);
  });

  it('save com o mesmo id sobrescreve', async () => {
    const repo = freshRepository();
    await repo.save(named('a', 'Primeiro', '2026-11-18T00:00:00.000Z'));
    await repo.save(named('a', 'Renomeado', '2026-11-18T01:00:00.000Z'));
    expect(await repo.list()).toEqual([
      { id: 'a', name: 'Renomeado', nodeCount: 0, updatedAt: '2026-11-18T01:00:00.000Z' },
    ]);
  });

  it('list resume cada grafo (FR-31)', async () => {
    const repo = freshRepository();
    await repo.save(landingPage());
    await repo.save(named('b', 'Vazio', '2026-11-17T00:00:00.000Z'));
    const summaries = await repo.list();
    expect([...summaries].sort((x, y) => x.name.localeCompare(y.name))).toEqual([
      { id: 'g1', name: 'Meu grafo', nodeCount: 7, updatedAt: '2026-11-18T00:00:00.000Z' },
      { id: 'b', name: 'Vazio', nodeCount: 0, updatedAt: '2026-11-17T00:00:00.000Z' },
    ]);
  });

  it('delete remove só o grafo pedido', async () => {
    const repo = freshRepository();
    await repo.save(named('a', 'A', '2026-11-18T00:00:00.000Z'));
    await repo.save(named('b', 'B', '2026-11-18T00:00:00.000Z'));
    await repo.delete(graphId('a'));
    await repo.delete(graphId('inexistente'));
    expect(await repo.get(graphId('a'))).toBeNull();
    expect((await repo.list()).map((s) => s.id)).toEqual(['b']);
  });

  it('bancos diferentes não se misturam', async () => {
    const first = freshRepository();
    const second = freshRepository();
    await first.save(landingPage());
    expect(await second.list()).toEqual([]);
  });

  it('funciona com o caso de uso ListGraphs', async () => {
    const repo = freshRepository();
    await repo.save(named('velho', 'Velho', '2026-11-01T00:00:00.000Z'));
    await repo.save(named('novo', 'Novo', '2026-11-18T00:00:00.000Z'));
    expect((await listGraphs(repo)).map((s) => s.id)).toEqual(['novo', 'velho']);
  });
});
