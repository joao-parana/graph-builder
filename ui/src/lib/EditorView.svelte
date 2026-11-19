<script lang="ts">
  // Editor (M1): topo, paleta, canvas e painel direito. Fica dentro do SvelteFlowProvider.
  import { useSvelteFlow } from '@xyflow/svelte';
  import type { NodeKind } from '@graph-builder/core';
  import Canvas from '#lib/canvas/Canvas.svelte';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { kindFrom } from '#lib/palette/drag.ts';
  import Palette from '#lib/palette/Palette.svelte';
  import { Editor } from '#lib/state/editor.svelte.ts';
  import { shortcutFor } from '#lib/state/shortcuts.ts';
  import Toast from '#lib/Toast.svelte';

  /** Metade da peça (190 × 72): o ponto do clique/soltura vira o centro dela. */
  const HALF = { x: 95, y: 36 };

  const editor = new Editor();
  const flow = useSvelteFlow();
  let canvasArea: HTMLElement | undefined = $state();

  function addAtCenter(kind: NodeKind) {
    const rect = canvasArea?.getBoundingClientRect();
    if (!rect) return;
    const center = flow.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    editor.addNode(kind, editor.freePosition({ x: center.x - HALF.x, y: center.y - HALF.y }));
  }

  function drop(event: DragEvent) {
    const kind = kindFrom(event.dataTransfer);
    if (kind === null) return;
    event.preventDefault();
    const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    editor.addNode(kind, { x: Math.round(point.x - HALF.x), y: Math.round(point.y - HALF.y) });
  }

  function keydown(event: KeyboardEvent) {
    const action = shortcutFor(event);
    if (action === null) return;
    event.preventDefault();
    switch (action) {
      case 'delete':
        editor.deleteSelection();
        break;
      case 'duplicate':
        editor.duplicateSelection();
        break;
      case 'undo':
        editor.undo();
        break;
      case 'redo':
        editor.redo();
        break;
      case 'cancel':
        editor.disarm();
        break;
    }
  }
</script>

<svelte:window onkeydown={keydown} />

<div class="editor" class:focus={editor.focus}>
  <header class="top">
    <span class="brand">◇ {ptBR.app.title}<small>{ptBR.app.brandNote}</small></span>
    <span class="title" data-testid="graph-name">{editor.graph.name}</span>
  </header>
  <div class="body">
    {#if !editor.focus}
      <Palette onadd={addAtCenter} />
    {/if}
    <main class="canvas-area" bind:this={canvasArea}>
      <Canvas {editor} ondropkind={drop} />
    </main>
    {#if !editor.focus}
      <aside class="inspector">
        <p class="help">{ptBR.inspector.placeholder}</p>
      </aside>
    {/if}
  </div>
  <Toast toast={editor.toast} ondismiss={() => (editor.toast = null)} />
</div>

<style>
  .editor {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100vh;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--line);
    background: var(--paper2);
  }
  .brand {
    font-family: var(--serif);
    font-size: 20px;
  }
  .brand small {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--muted);
    margin-left: 10px;
    text-transform: uppercase;
  }
  .title {
    flex: 1;
    text-align: center;
    font-weight: 500;
    margin-right: 200px;
  }
  .body {
    display: grid;
    grid-template-columns: 230px 1fr 300px;
    min-height: 0;
  }
  .focus .body {
    grid-template-columns: 1fr;
  }
  .canvas-area {
    min-height: 0;
    min-width: 0;
  }
  .inspector {
    border-left: 1px solid var(--line);
    padding: 14px;
    background: var(--paper2);
    font-size: 13px;
  }
  .help {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
  }
</style>
