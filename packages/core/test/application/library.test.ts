import { describe, expect, it } from 'vitest';
import { deleteGraph, listGraphs, openGraph, saveGraph } from '../../src/application/index.ts';
import { type Graph, graphId } from '../../src/domain/index.ts';
import { landingPage } from '../domain/fixtures.ts';
import { MemoryRepository } from './fakes.ts';

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
});
