<script lang="ts">
  // Linhas "Recebe de: …" com nomes clicáveis (FR-11).
  import type { GraphNode, NodeId } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';

  let {
    rows,
    onreveal,
  }: {
    rows: readonly {
      label: string;
      nodes: readonly GraphNode[];
      /** Mostra "ninguém ainda" em vez de esconder a linha (FR-14). */
      required?: boolean;
    }[];
    onreveal: (id: NodeId) => void;
  } = $props();
</script>

<div class="rel">
  {#each rows as row (row.label)}
    {#if row.nodes.length > 0 || row.required === true}
      <div data-testid="link-row">
        {row.label}{row.label.endsWith('→') ? ' ' : ': '}
        {#if row.nodes.length === 0}
          <span class="nobody">{ptBR.inspector.nobody}</span>
        {:else}
          {#each row.nodes as node, index (node.id)}
            {#if index > 0},
            {/if}<button
              type="button"
              class="link"
              onclick={() => {
                onreveal(node.id);
              }}>{node.name}</button
            >
          {/each}
        {/if}
      </div>
    {/if}
  {/each}
</div>
