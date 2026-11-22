<script lang="ts">
  // Editor (M1): topo, paleta, canvas e painel direito. Fica dentro do SvelteFlowProvider.
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, tick } from 'svelte';
  import {
    type Graph,
    IndexedDbGraphRepository,
    type NodeId,
    type NodeKind,
    validateGraph,
    type ValidationIssue,
  } from '@graph-builder/core';
  import Canvas from '#lib/canvas/Canvas.svelte';
  import { cloudConfig } from '#lib/cloud/config.ts';
  import Inspector from '#lib/inspector/Inspector.svelte';
  import ClearModal from '#lib/modals/ClearModal.svelte';
  import ExportModal from '#lib/modals/ExportModal.svelte';
  import HelpModal from '#lib/modals/HelpModal.svelte';
  import ImportModal from '#lib/modals/ImportModal.svelte';
  import LibraryModal from '#lib/modals/LibraryModal.svelte';
  import NoticeModal from '#lib/modals/NoticeModal.svelte';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { kindFrom } from '#lib/palette/drag.ts';
  import Palette from '#lib/palette/Palette.svelte';
  import { Editor } from '#lib/state/editor.svelte.ts';
  import { Session } from '#lib/state/session.svelte.ts';
  import { shortcutFor } from '#lib/state/shortcuts.ts';
  import { Workspace } from '#lib/state/workspace.svelte.ts';
  import Toast from '#lib/Toast.svelte';
  import TopBar from '#lib/TopBar.svelte';
  import type { ModalName } from '#lib/modals/modal-name.ts';
  import { flaggedNodeIds } from '#lib/validation/messages.ts';
  import PreExportPanel from '#lib/validation/PreExportPanel.svelte';

  /** FR-20: espera entre a última mudança e o recálculo. */
  const VALIDATION_DEBOUNCE_MS = 150;

  /** Metade da peça (190 × 72): o ponto do clique/soltura vira o centro dela. */
  const HALF = { x: 95, y: 36 };

  const editor = new Editor();
  const local = new IndexedDbGraphRepository();
  const workspace = new Workspace(editor, local);

  /** ADR-0004, item 9: sem as variáveis do Supabase no build, só o modo local. */
  const config = cloudConfig;
  const session = new Session({
    workspace,
    local,
    cloud:
      config === null
        ? null
        : () => import('#lib/cloud/services.ts').then((m) => m.cloudServices(config)),
    notify: (message: string) => {
      editor.notify(message);
    },
  });
  const flow = useSvelteFlow();
  /** O canvas só monta com o grafo salvo já aberto (FR-30). */
  let ready = $state(false);
  let modal: ModalName | null = $state(null);

  onMount(() => {
    session.start().then(
      () => (ready = true),
      () => {
        ready = true;
        editor.notify(ptBR.top.saveFailed);
      },
    );
    const hide = () => {
      if (document.visibilityState === 'hidden') void workspace.flush();
    };
    /** FR-55: a gravação que falhou sem conexão é tentada de novo quando ela volta. */
    const online = () => {
      if (workspace.status === 'error') workspace.schedule();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('online', online);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('online', online);
      session.stop();
    };
  });

  /** FR-30: cada mudança do grafo ou do viewport agenda a gravação. */
  $effect(() => {
    // `schedule` lê o grafo e o viewport: o efeito roda de novo quando eles mudam.
    if (ready) workspace.schedule();
  });

  const closeModal = () => (modal = null);

  async function imported(graph: Graph) {
    await workspace.importGraph(graph);
    modal = null;
    editor.notify(ptBR.importer.opened(graph.name));
  }
  let canvasArea: HTMLElement | undefined = $state();
  let issues: readonly ValidationIssue[] = $state.raw(validateGraph(editor.graph));
  const flagged = $derived(flaggedNodeIds(issues));

  $effect(() => {
    const graph = editor.graph;
    const timer = setTimeout(() => (issues = validateGraph(graph)), VALIDATION_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  });

  /** FR-11, FR-20: seleciona e centraliza a peça, sem mudar o zoom. */
  function reveal(id: NodeId) {
    const node = editor.graph.nodes.find((n) => n.id === id);
    if (node === undefined) return;
    editor.select([id]);
    void flow.setCenter(node.position.x + HALF.x, node.position.y + HALF.y, {
      zoom: flow.getZoom(),
      duration: 200,
    });
  }

  /** FR-20: item sem peça tira a seleção; o VAL-01 põe o foco no Objetivo. */
  async function pick(issue: ValidationIssue) {
    const first = issue.nodeIds[0];
    if (first !== undefined) {
      reveal(first);
      return;
    }
    editor.select([]);
    if (issue.rule === 'VAL-01') {
      editor.focus = false;
      await tick();
      document.getElementById('graph-objective')?.focus();
    }
  }

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
    if (modal !== null || session.notice !== null) return; // atalhos não agem com modal aberto
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
  <TopBar
    {editor}
    {session}
    status={workspace.status}
    onopen={(name: ModalName) => (modal = name)}
  />
  <div class="body">
    {#if !editor.focus && ready}
      <Palette onadd={addAtCenter} />
    {:else if !editor.focus}
      <div></div>
    {/if}
    <main class="canvas-area" bind:this={canvasArea}>
      {#if ready}
        {#key editor.loads}
          <Canvas {editor} {flagged} ondropkind={drop} />
        {/key}
      {/if}
      <PreExportPanel {issues} onpick={(issue: ValidationIssue) => void pick(issue)} />
    </main>
    {#if !editor.focus && ready}
      <Inspector {editor} onreveal={reveal} />
    {/if}
  </div>
  {#if modal === 'export'}
    <ExportModal
      graph={editor.graph}
      onclose={closeModal}
      onnotify={(message: string) => {
        editor.notify(message);
      }}
    />
  {:else if modal === 'import'}
    <ImportModal ctx={editor.ctx} onclose={closeModal} onimport={(g: Graph) => void imported(g)} />
  {:else if modal === 'library'}
    <LibraryModal {workspace} {session} onclose={closeModal} />
  {:else if modal === 'clear'}
    <ClearModal
      onclose={closeModal}
      onconfirm={() => {
        editor.clear();
        modal = null;
      }}
    />
  {:else if modal === 'help'}
    <HelpModal cloud={session.cloudAvailable} onclose={closeModal} />
  {/if}
  {#if session.notice !== null}
    <NoticeModal
      message={session.notice}
      onclose={() => {
        session.dismissNotice();
      }}
    />
  {/if}
  <Toast toast={editor.toast} ondismiss={() => (editor.toast = null)} />
</div>

<style>
  .editor {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100vh;
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
    position: relative;
    min-height: 0;
    min-width: 0;
  }
</style>
