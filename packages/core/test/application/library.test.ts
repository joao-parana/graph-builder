import { describe, expect, it } from 'vitest';
import {
  deleteGraph,
  duplicateGraph,
  listGraphs,
  openGraph,
  renameGraph,
  saveGraph,
} from '../../src/application/index.ts';
import { type Graph, graphId } from '../../src/domain/index.ts';
import { landingPage } from '../domain/fixtures.ts';
import { context, MemoryRepository } from './fakes.ts';

const at = (id: string, name: string, updatedAt: string): Graph => ({
  ...landingPage(),
  id: graphId(id),
  name,
  updatedAt,
});

describe('Meus grafos (FR-30, FR-31)', () => {
  it('lista o mais recente primeiro e, no empate, pelo nome', async () => {
    const repo = new MemoryRepository();
    await saveGraph(repo, at('a', 'Beta', '2026-11-17T00:00:00.000Z'));
    await saveGraph(repo, at('b', 'Gama', '2026-11-18T00:00:00.000Z'));
    await saveGraph(repo, at('c', 'Alfa', '2026-11-17T00:00:00.000Z'));
    const list = await listGraphs(repo);
    expect(list.map((s) => s.name)).toEqual(['Gama', 'Alfa', 'Beta']);
    expect(list[0]).toEqual({
      id: 'b',
      name: 'Gama',
      nodeCount: 7,
      updatedAt: '2026-11-18T00:00:00.000Z',
    });
  });

  it('abre, salva por cima e apaga', async () => {
    const repo = new MemoryRepository();
    const g = at('a', 'Alfa', '2026-11-18T00:00:00.000Z');
    await saveGraph(repo, g);
    await saveGraph(repo, { ...g, name: 'Alfa 2' });
    expect((await openGraph(repo, g.id))?.name).toBe('Alfa 2');
    await deleteGraph(repo, g.id);
    expect(await openGraph(repo, g.id)).toBeNull();
    expect(await listGraphs(repo)).toEqual([]);
  });

  it('duplica com id novo e " (cópia)", cortando o nome para caber em 80', () => {
    const g = at('a', 'Alfa', '2026-11-01T00:00:00.000Z');
    const copy = duplicateGraph(context(), g);
    expect(copy).toMatchObject({
      id: 'id-1',
      name: 'Alfa (cópia)',
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    });
    expect(copy.nodes).toBe(g.nodes);
    const long = duplicateGraph(context(), { ...g, name: `${'é'.repeat(79)}👍🏽` });
    expect(long.name).toBe(`${'é'.repeat(72)} (cópia)`);
  });

  it('renomeia um grafo salvo; nome inválido e grafo sumido não gravam', async () => {
    const repo = new MemoryRepository();
    const g = at('a', 'Alfa', '2026-11-01T00:00:00.000Z');
    await saveGraph(repo, g);
    expect(await renameGraph(context(), repo, g.id, '  Beta ')).toMatchObject({
      ok: true,
      value: { name: 'Beta', updatedAt: '2026-11-18T00:00:00.000Z' },
    });
    expect((await openGraph(repo, g.id))?.name).toBe('Beta');
    expect(await renameGraph(context(), repo, g.id, ' ')).toMatchObject({
      ok: false,
      error: { code: 'INV-09', reason: 'empty' },
    });
    expect((await openGraph(repo, g.id))?.name).toBe('Beta');
    expect(await renameGraph(context(), repo, graphId('x'), 'Gama')).toBeNull();
  });
});
