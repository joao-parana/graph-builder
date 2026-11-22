import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GraphId, graphId, NodeKind } from '@graph-builder/core';
import { Editor } from './editor.svelte.ts';
import { MemoryRepo } from './test-repo.ts';
import { testContext } from './test-context.ts';
import { SAVE_DEBOUNCE_MS, Workspace } from './workspace.svelte.ts';

function setup(repo = new MemoryRepo()) {
  const editor = new Editor(testContext());
  return { repo, editor, workspace: new Workspace(editor, repo) };
}

const stored = (repo: MemoryRepo, id: GraphId) => repo.graphs.get(id);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Workspace — salvamento automático (FR-30)', () => {
  it('sem grafos, cria um e salva; com grafos, abre o mais recente', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    expect(repo.graphs.size).toBe(1);
    expect(stored(repo, editor.graph.id)).toBe(editor.graph);

    const old = {
      ...editor.graph,
      id: graphId('old'),
      name: 'Velho',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const recent = {
      ...old,
      id: graphId('new'),
      name: 'Novo',
      updatedAt: '2026-11-01T00:00:00.000Z',
      viewport: { x: 5, y: 6, zoom: 0.5 },
    };
    const again = setup(new MemoryRepo());
    again.repo.graphs.set(old.id, old);
    again.repo.graphs.set(recent.id, recent);
    await again.workspace.start();
    expect(again.editor.graph.name).toBe('Novo');
    expect(again.editor.viewport).toEqual({ x: 5, y: 6, zoom: 0.5 });
    expect(again.repo.saves).toBe(0);
  });

  it('grava 500 ms depois da última mudança, uma vez só', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    const saves = repo.saves;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    workspace.schedule();
    editor.addNode(NodeKind.Worker, { x: 0, y: 100 });
    workspace.schedule();
    expect(workspace.status).toBe('saving');
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1);
    expect(repo.saves).toBe(saves);
    await vi.advanceTimersByTimeAsync(1);
    expect(repo.saves).toBe(saves + 1);
    expect(workspace.status).toBe('saved');
    expect(stored(repo, editor.graph.id)?.nodes).toHaveLength(2);
    workspace.schedule(); // nada mudou
    expect(workspace.status).toBe('saved');
  });

  it('viewport é salvo sem mudar o grafo do histórico', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    const before = editor.graph;
    editor.viewport = { x: 10, y: 20, zoom: 1.5 };
    workspace.schedule();
    await workspace.flush();
    expect(editor.graph).toBe(before);
    expect(stored(repo, before.id)).toMatchObject({
      viewport: { x: 10, y: 20, zoom: 1.5 },
      updatedAt: before.updatedAt,
    });
  });

  it('falha ao gravar: "não salvo" e toast', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    repo.fail = true;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    workspace.schedule();
    await workspace.flush();
    expect(workspace.status).toBe('error');
    expect(editor.toast?.message).toBe('Não foi possível salvar no navegador');
  });
});

describe('Workspace — Meus grafos (FR-22, FR-31)', () => {
  it('novo grafo grava o pendente, zera o histórico e lista os dois', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    const first = editor.graph.id;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    workspace.schedule();
    await workspace.newGraph();
    expect(stored(repo, first)?.nodes).toHaveLength(1);
    expect(editor.graph.id).not.toBe(first);
    expect(editor.canUndo).toBe(false);
    expect(workspace.graphs).toHaveLength(2);

    expect(await workspace.open(first)).toBe(true);
    expect(editor.graph.nodes).toHaveLength(1);
    expect(await workspace.open(first)).toBe(true);
    expect(await workspace.open(graphId('sumiu'))).toBe(false);
  });

  it('importar salva e abre o grafo', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    const graph = { ...editor.graph, id: graphId('imp'), name: 'Importado' };
    await workspace.importGraph(graph);
    expect(editor.graph).toBe(graph);
    expect(stored(repo, graph.id)).toBe(graph);
  });

  it('duplica e renomeia; no aberto, renomear é desfazível', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    const id = editor.graph.id;
    await workspace.duplicate(id);
    const copy = workspace.graphs.find((g) => g.id !== id);
    expect(copy?.name).toBe('Meu grafo (cópia)');
    if (copy === undefined) throw new Error('cópia');

    expect(await workspace.rename(copy.id, 'Outro')).toBeNull();
    expect(stored(repo, copy.id)?.name).toBe('Outro');
    expect(await workspace.rename(copy.id, '')).toMatchObject({ code: 'INV-09' });

    expect(await workspace.rename(id, 'Landing')).toBeNull();
    expect(editor.graph.name).toBe('Landing');
    expect(stored(repo, id)?.name).toBe('Landing');
    expect(await workspace.rename(id, ' ')).toMatchObject({ reason: 'empty' });
    editor.undo();
    expect(editor.graph.name).toBe('Meu grafo');
  });

  it('apagar o aberto abre o mais recente que sobrar, ou um novo', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    const first = editor.graph.id;
    await workspace.newGraph();
    const second = editor.graph.id;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    workspace.schedule();
    await workspace.remove(second);
    expect(repo.graphs.has(second)).toBe(false);
    expect(editor.graph.id).toBe(first);
    await workspace.remove(graphId('outro'));
    expect(editor.graph.id).toBe(first);
    await workspace.remove(first);
    expect(repo.graphs.size).toBe(1);
    expect(editor.graph.id).not.toBe(first);
  });
});

describe('Workspace — modos (FR-53, FR-54, FR-56)', () => {
  it('use grava o pendente no repositório antigo e abre o mais recente do novo', async () => {
    const { repo, editor, workspace } = setup();
    await workspace.start();
    const localId = editor.graph.id;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    workspace.schedule();
    const cloud = new MemoryRepo();
    await workspace.use(cloud);
    expect(stored(repo, localId)?.nodes).toHaveLength(1);
    expect(cloud.graphs.size).toBe(1);
    expect(editor.graph.id).not.toBe(localId);
    expect(workspace.graphs.map((g) => g.id)).toEqual([editor.graph.id]);
    expect(workspace.status).toBe('saved');
  });

  it('a falha usa o texto do repositório atual', async () => {
    const { editor, workspace } = setup();
    const notify = vi.spyOn(editor, 'notify');
    const cloud = new MemoryRepo();
    await workspace.use(cloud, () => 'falhou na nuvem');
    cloud.fail = true;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    workspace.schedule();
    await workspace.flush();
    expect(workspace.status).toBe('error');
    expect(notify).toHaveBeenCalledWith('falhou na nuvem');
  });

  it('copyTo grava antes e copia com id novo; keepIn guarda o aberto com o mesmo id', async () => {
    const { editor, workspace } = setup();
    await workspace.start();
    const id = editor.graph.id;
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    workspace.schedule();
    const other = new MemoryRepo();
    const copy = await workspace.copyTo(id, other);
    expect(copy?.id).not.toBe(id);
    expect(copy && stored(other, copy.id)?.nodes).toHaveLength(1);
    expect(await workspace.copyTo(graphId('nada'), other)).toBeNull();

    const rescue = new MemoryRepo();
    await workspace.keepIn(rescue);
    expect(stored(rescue, id)?.nodes).toHaveLength(1);
  });
});
