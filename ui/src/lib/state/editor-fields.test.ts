import { describe, expect, it } from 'vitest';
import { NodeKind } from '@graph-builder/core';
import { Editor } from './editor.svelte.ts';
import { testContext } from './test-context.ts';

function setup() {
  const editor = new Editor(testContext());
  editor.addNode(NodeKind.Worker, { x: 0, y: 0 });
  editor.addNode(NodeKind.Decision, { x: 240, y: 0 });
  editor.addNode(NodeKind.Delivery, { x: 480, y: 0 });
  editor.addNode(NodeKind.Supervisor, { x: 720, y: 0 });
  editor.addNode(NodeKind.Memory, { x: 0, y: 240 });
  const [worker, decision, delivery, supervisor, memory] = editor.graph.nodes;
  if (!worker || !decision || !delivery || !supervisor || !memory) throw new Error('setup');
  editor.connect(decision.id, delivery.id);
  return { editor, worker, decision, delivery, supervisor, memory };
}

describe('Editor — edição de campos (FR-08, FR-10..14)', () => {
  it('várias teclas no mesmo campo = um passo de desfazer', () => {
    const { editor, worker } = setup();
    const steps = editor.history.past.length;
    for (const text of ['E', 'Es', 'Esc', 'Escreva']) {
      expect(editor.editNode(worker.id, 'instructions', { instructions: text })).toBeNull();
    }
    expect(editor.graph.nodes[0]?.instructions).toBe('Escreva');
    expect(editor.history.past.length).toBe(steps + 1);
    editor.undo();
    expect(editor.graph.nodes[0]?.instructions).toBe('');
  });

  it('endEdit fecha o passo; outro campo abre outro', () => {
    const { editor, worker } = setup();
    const steps = editor.history.past.length;
    editor.editNode(worker.id, 'instructions', { instructions: 'a' });
    editor.endEdit();
    editor.editNode(worker.id, 'instructions', { instructions: 'ab' });
    editor.editNode(worker.id, 'name', { name: 'Redator' });
    expect(editor.history.past.length).toBe(steps + 3);
  });

  it('um comando no meio fecha o passo do campo', () => {
    const { editor, worker } = setup();
    const steps = editor.history.past.length;
    editor.editNode(worker.id, 'instructions', { instructions: 'a' });
    editor.addNode(NodeKind.Worker, { x: 0, y: 500 });
    editor.editNode(worker.id, 'instructions', { instructions: 'ab' });
    expect(editor.history.past.length).toBe(steps + 3);
  });

  it('desfazer no meio da edição fecha o passo', () => {
    const { editor, worker } = setup();
    editor.editNode(worker.id, 'instructions', { instructions: 'a' });
    editor.undo();
    editor.editNode(worker.id, 'instructions', { instructions: 'b' });
    editor.undo();
    expect(editor.graph.nodes[0]?.instructions).toBe('');
    editor.redo();
    editor.editNode(worker.id, 'instructions', { instructions: 'bc' });
    expect(editor.canRedo).toBe(false);
  });

  it('nome recusado devolve o erro, sem toast e sem mudar o grafo', () => {
    const { editor, worker } = setup();
    const before = editor.graph;
    expect(editor.editNode(worker.id, 'name', { name: 'Decisão 1' })).toMatchObject({
      code: 'INV-07',
      reason: 'duplicate',
    });
    expect(editor.editNode(worker.id, 'name', { name: ' ' })).toMatchObject({ reason: 'empty' });
    expect(editor.graph).toBe(before);
    expect(editor.toast).toBeNull();
  });

  it('rodadas fora de 1..10 → INV-08', () => {
    const { editor, supervisor } = setup();
    expect(editor.editNode(supervisor.id, 'maxRounds', { maxRounds: 11 })).toMatchObject({
      code: 'INV-08',
    });
    expect(editor.editNode(supervisor.id, 'maxRounds', { maxRounds: Number.NaN })).not.toBeNull();
    expect(editor.editNode(supervisor.id, 'maxRounds', { maxRounds: 5 })).toBeNull();
  });

  it('nome e objetivo do grafo (INV-09)', () => {
    const { editor } = setup();
    expect(editor.editGraph('objective', { objective: 'Entregar X' })).toBeNull();
    expect(editor.graph.objective).toBe('Entregar X');
    expect(editor.editGraph('name', { name: '' })).toMatchObject({ code: 'INV-09' });
    expect(editor.editGraph('name', { name: 'Landing' })).toBeNull();
    expect(editor.graph.name).toBe('Landing');
  });

  it('condição do caminho (FR-13); mesmo texto não cria passo', () => {
    const { editor } = setup();
    const edge = editor.graph.edges[0];
    if (!edge) throw new Error('setup');
    expect(editor.editCondition(edge.id, 'se aprovado')).toBeNull();
    const steps = editor.history.past.length;
    editor.endEdit();
    expect(editor.editCondition(edge.id, 'se aprovado')).toBeNull();
    expect(editor.history.past.length).toBe(steps);
    expect(editor.graph.edges[0]?.condition).toBe('se aprovado');
  });

  it('preset liga e desliga a linha da barra (FR-12)', () => {
    const { editor, supervisor } = setup();
    editor.editNode(supervisor.id, 'instructions', { instructions: 'Reprove se vago.' });
    expect(editor.togglePreset(supervisor.id, 'wow')).toBe(true);
    const sup = () => editor.graph.nodes.find((n) => n.id === supervisor.id);
    expect(sup()?.instructions).toBe('Reprove se vago.\nTodo crítico aprova com reação "uau".');
    editor.togglePreset(supervisor.id, 'wow');
    expect(sup()?.instructions).toBe('Reprove se vago.');
    expect(editor.togglePreset(editor.graph.nodes[0]?.id ?? supervisor.id, 'wow')).toBe(false);
    expect(editor.toast?.message).toBe('Ação não se aplica a esse item');
  });

  it('relações e "Se esgotar" são um passo por clique (FR-12, FR-14)', () => {
    const { editor, memory, supervisor } = setup();
    expect(editor.updateNode(memory.id, { relations: ['ideia', ' ideia ', 'fonte'] })).toBe(true);
    expect(editor.graph.nodes.find((n) => n.id === memory.id)).toMatchObject({
      relations: ['ideia', 'fonte'],
    });
    expect(editor.updateNode(supervisor.id, { onExhausted: 'fail' })).toBe(true);
    expect(editor.updateNode(memory.id, { onExhausted: 'fail' })).toBe(false);
  });
});
