<script lang="ts">
  // Painel direito (FR-10..15): Grafo, peça ou várias peças, conforme a seleção.
  import type { NodeId } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import type { Editor } from '#lib/state/editor.svelte.ts';
  import GraphPanel from './GraphPanel.svelte';
  import NodePanel from './NodePanel.svelte';

  let { editor, onreveal }: { editor: Editor; onreveal: (id: NodeId) => void } = $props();

  const selected = $derived(
    editor.graph.nodes.filter((node) => editor.selectedNodeIds.includes(node.id)),
  );
</script>

<aside class="inspector" aria-label="Inspetor">
  {#if selected.length === 0}
    <GraphPanel {editor} />
  {:else if selected.length === 1 && selected[0]}
    <NodePanel {editor} node={selected[0]} {onreveal} />
  {:else}
    <p data-testid="many-selected">{ptBR.inspector.manySelected(selected.length)}</p>
    <button type="button" class="btn danger" onclick={() => editor.deleteSelection()}>
      {ptBR.inspector.delete}
    </button>
  {/if}
</aside>
