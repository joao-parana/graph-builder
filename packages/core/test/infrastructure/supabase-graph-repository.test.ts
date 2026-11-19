// RLS e falhas do SupabaseGraphRepository (NFR-09, SPEC §7.4, §10), contra o Supabase local.
import { afterEach, describe, expect, it } from 'vitest';
import { graphId } from '../../src/domain/index.ts';
import { CloudStorageError, SupabaseGraphRepository } from '../../src/infrastructure/index.ts';
import { landingPage } from '../domain/fixtures.ts';
import {
  adminClient,
  anonymousClient,
  createTestUser,
  local,
  type TestUser,
} from './supabase-local.ts';

let users: TestUser[] = [];
afterEach(async () => {
  await Promise.all(users.map((user) => user.remove()));
  users = [];
});

describe.skipIf(local === null)('SupabaseGraphRepository (Supabase local)', () => {
  const env = () => {
    if (local === null) throw new Error('Supabase local fora do ar');
    return local;
  };
  const user = async () => {
    const created = await createTestUser(env());
    users.push(created);
    return created;
  };

  it('RLS: um usuário não lê, não altera e não apaga o grafo do outro', async () => {
    const alice = new SupabaseGraphRepository((await user()).client);
    const bob = new SupabaseGraphRepository((await user()).client);
    const g = landingPage();
    await alice.save(g);

    expect(await bob.list()).toEqual([]);
    expect(await bob.get(g.id)).toBeNull();

    // O mesmo GraphId no Bob cria a linha dele (chave owner_id + id); a da Alice não muda.
    await bob.save({ ...g, name: 'Do Bob' });
    await bob.delete(g.id);
    expect(await bob.list()).toEqual([]);
    expect(await alice.get(g.id)).toEqual(g);
  });

  it('sem sessão, nada: listar, abrir, salvar e apagar falham', async () => {
    const anon = new SupabaseGraphRepository(anonymousClient(env()));
    const g = landingPage();
    await expect(anon.list()).rejects.toThrow(CloudStorageError);
    await expect(anon.get(g.id)).rejects.toThrow(/abrir o grafo/);
    await expect(anon.save(g)).rejects.toThrow(/salvar o grafo/);
    await expect(anon.delete(g.id)).rejects.toThrow(/apagar o grafo/);
  });

  it('o dono gravado é sempre o da sessão (with check do RLS)', async () => {
    const alice = await user();
    const bob = await user();
    const { error } = await alice.client.from('graphs').insert({
      owner_id: bob.id,
      id: 'intruso',
      name: 'x',
      node_count: 0,
      updated_at: '2026-11-18T00:00:00.000Z',
      data: {},
    });
    expect(error?.code).toBe('42501');
  });

  it('grafo guardado que não passa no codec → CloudStorageError com o campo', async () => {
    const alice = await user();
    const seeded = await adminClient(env())
      .from('graphs')
      .insert({
        owner_id: alice.id,
        id: 'quebrado',
        name: 'Quebrado',
        node_count: 0,
        updated_at: '2026-11-18T00:00:00.000Z',
        data: { schemaVersion: 1 },
      });
    expect(seeded.error).toBeNull();
    const repo = new SupabaseGraphRepository(alice.client);
    await expect(repo.get(graphId('quebrado'))).rejects.toThrow(/ler o grafo/);
    expect((await repo.list()).map((s) => s.name)).toEqual(['Quebrado']);
  });
});
