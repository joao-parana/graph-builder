import { describe, expect, it } from 'vitest';
import { EdgeKind, edgeId, NodeKind, nodeId } from '@graph-builder/core';
import { Editor } from './editor.svelte.ts';
import { testContext } from './test-context.ts';

const fresh = () => new Editor(testContext());
const ids = (editor: Editor) => editor.graph.nodes.map((n) => n.id as string);

function withChain() {
  const editor = fresh();
  editor.addNode(NodeKind.Input, { x: 0, y: 0 });
  editor.addNode(NodeKind.Worker, { x: 240, y: 0 });
  const [input, worker] = editor.graph.nodes;
  if (!input || !worker) throw new Error('setup');
  editor.connect(input.id, worker.id);
  return { editor, input, worker };
}

describe('Editor — adicionar (FR-01)', () => {
  it('começa com um grafo vazio e sem histórico', () => {
    const editor = fresh();
    expect(editor.graph.nodes).toEqual([]);
    expect(editor.canUndo).toBe(false);
    expect(editor.canRedo).toBe(false);
  });

  it('adiciona, nomeia e seleciona a peça nova', () => {
    const editor = fresh();
    expect(editor.addNode(NodeKind.Worker, { x: 10, y: 20 })).toBe(true);
    expect(editor.graph.nodes[0]?.name).toBe('Trabalhador 1');
    expect(editor.selectedNodeIds).toEqual(['id2']);
    expect(editor.canUndo).toBe(true);
  });

  it('segunda Entrada é recusada com toast e não muda o grafo', () => {
    const editor = fresh();
    editor.addNode(NodeKind.Input, { x: 0, y: 0 });
    const before = editor.graph;
    expect(editor.addNode(NodeKind.Input, { x: 0, y: 0 })).toBe(false);
    expect(editor.graph).toBe(before);
    expect(editor.toast?.message).toBe('Só uma Entrada por grafo');
  });

  it('toasts seguidos têm ids diferentes', () => {
    const editor = fresh();
    editor.notify('a');
    const first = editor.toast?.id;
    editor.notify('a');
    expect(editor.toast?.id).not.toBe(first);
  });

  it('freePosition: grade de 16 px e cascata de +32 px', () => {
    const editor = fresh();
    expect(editor.freePosition({ x: 7, y: 9 })).toEqual({ x: 0, y: 16 });
    editor.addNode(NodeKind.Worker, { x: 0, y: 16 });
    editor.addNode(NodeKind.Worker, { x: 32, y: 48 });
    expect(editor.freePosition({ x: 3, y: 15 })).toEqual({ x: 64, y: 80 });
  });
});

describe('Editor — ligar e cortar (FR-02, FR-03)', () => {
  it('liga com o tipo derivado', () => {
    const { editor } = withChain();
    expect(editor.graph.edges).toMatchObject([{ kind: EdgeKind.Flow }]);
  });

  it('ligação inválida vira toast', () => {
    const { editor, input, worker } = withChain();
    expect(editor.connect(worker.id, input.id)).toBe(false);
    expect(editor.toast?.message).toBe('A Entrada não recebe fios');
  });

  it('1º clique arma, 2º clique corta, desfazer devolve', () => {
    const { editor } = withChain();
    const edge = editor.graph.edges[0];
    if (!edge) throw new Error('setup');
    editor.select([nodeId('id2')]);
    editor.clickEdge(edge.id);
    expect(editor.armedEdgeId).toBe(edge.id);
    expect(editor.selectedNodeIds).toEqual([]);
    editor.clickEdge(edge.id);
    expect(editor.graph.edges).toEqual([]);
    expect(editor.armedEdgeId).toBeNull();
    editor.undo();
    expect(editor.graph.edges).toHaveLength(1);
  });

  it('clicar em outro fio troca o armado; disarm cancela', () => {
    const { editor } = withChain();
    editor.clickEdge(edgeId('a'));
    editor.clickEdge(edgeId('b'));
    expect(editor.armedEdgeId).toBe('b');
    editor.disarm();
    expect(editor.armedEdgeId).toBeNull();
    expect(editor.cutArmedEdge()).toBe(false);
  });

  it('Del corta o fio armado antes de apagar peças', () => {
    const { editor } = withChain();
    const edge = editor.graph.edges[0];
    if (!edge) throw new Error('setup');
    editor.clickEdge(edge.id);
    expect(editor.deleteSelection()).toBe(true);
    expect(editor.graph.edges).toEqual([]);
    expect(editor.graph.nodes).toHaveLength(2);
  });

  it('fio armado que some no desfazer é desarmado', () => {
    const { editor } = withChain();
    const edge = editor.graph.edges[0];
    if (!edge) throw new Error('setup');
    editor.clickEdge(edge.id);
    editor.undo();
    expect(editor.armedEdgeId).toBeNull();
  });
});

describe('Editor — apagar, duplicar, mover (FR-04..06)', () => {
  it('apaga as selecionadas num passo só', () => {
    const { editor, input, worker } = withChain();
    editor.select([input.id, worker.id]);
    expect(editor.deleteSelection()).toBe(true);
    expect(editor.graph.nodes).toEqual([]);
    expect(editor.selectedNodeIds).toEqual([]);
    editor.undo();
    expect(editor.graph.nodes).toHaveLength(2);
    expect(editor.graph.edges).toHaveLength(1);
  });

  it('sem seleção, apagar e duplicar não fazem nada', () => {
    const editor = fresh();
    expect(editor.deleteSelection()).toBe(false);
    expect(editor.duplicateSelection()).toBe(false);
  });

  it('duplica e seleciona as cópias', () => {
    const { editor, worker } = withChain();
    editor.select([worker.id]);
    expect(editor.duplicateSelection()).toBe(true);
    const copy = editor.graph.nodes.at(-1);
    expect(copy?.name).toBe('Trabalhador 2');
    expect(copy?.position).toEqual({ x: 272, y: 32 });
    expect(editor.selectedNodeIds).toEqual([copy?.id]);
  });

  it('duplicar a Entrada é recusado e não deixa passo parcial', () => {
    const { editor, input, worker } = withChain();
    editor.select([worker.id, input.id]);
    const before = editor.graph;
    expect(editor.duplicateSelection()).toBe(false);
    expect(editor.graph).toBe(before);
    expect(editor.toast?.message).toBe('Só uma Entrada por grafo');
  });

  it('move com snap (padrão) e sem snap', () => {
    const { editor, worker } = withChain();
    editor.moveNodes([{ id: worker.id, position: { x: 101, y: 7 } }]);
    expect(editor.graph.nodes[1]?.position).toEqual({ x: 96, y: 0 });
    editor.snap = false;
    editor.moveNodes([{ id: worker.id, position: { x: 101, y: 7 } }]);
    expect(editor.graph.nodes[1]?.position).toEqual({ x: 101, y: 7 });
  });

  it('peça inexistente vira toast', () => {
    const editor = fresh();
    expect(editor.moveNodes([{ id: nodeId('x'), position: { x: 0, y: 0 } }])).toBe(false);
    expect(editor.toast?.message).toBe('A peça não existe mais');
  });
});

describe('Editor — Arrumar e histórico (FR-07, FR-08)', () => {
  it('Arrumar põe a Entrada antes do Trabalhador e é desfazível', () => {
    const { editor } = withChain();
    editor.moveNodes([{ id: nodeId('id2'), position: { x: 800, y: 800 } }]);
    expect(editor.arrange()).toBe(true);
    const [input, worker] = editor.graph.nodes;
    expect((input?.position.x ?? 0) < (worker?.position.x ?? 0)).toBe(true);
    editor.undo();
    expect(editor.graph.nodes[0]?.position).toEqual({ x: 800, y: 800 });
  });

  it('desfazer tira da seleção o que sumiu; refazer volta', () => {
    const editor = fresh();
    editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
    editor.undo();
    expect(ids(editor)).toEqual([]);
    expect(editor.selectedNodeIds).toEqual([]);
    expect(editor.canRedo).toBe(true);
    editor.redo();
    expect(ids(editor)).toEqual(['id2']);
  });

  it('select ignora a mesma seleção', () => {
    const editor = fresh();
    const before = editor.selectedNodeIds;
    editor.select([]);
    expect(editor.selectedNodeIds).toBe(before);
  });
});
