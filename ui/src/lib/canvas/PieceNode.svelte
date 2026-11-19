<script lang="ts">
  // Peça no canvas (M1). Alças: entrada à esquerda, saída à direita, ponto dourado no topo (§3.3).
  import { Handle, type NodeProps, Position } from '@xyflow/svelte';
  import { NODE_KIND_LABEL, NodeKind } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { HANDLE, type PieceNode } from './mapping.ts';

  let { data, selected }: NodeProps<PieceNode> = $props();

  const hasInput = $derived(data.kind !== NodeKind.Input);
  const summary = $derived(
    data.kind === NodeKind.Memory
      ? data.relations.length === 0
        ? ptBR.node.relationsEmpty
        : data.relations.join(' · ')
      : data.instructions.trim() || ptBR.node.noInstructions,
  );
</script>

<div
  class="piece"
  class:selected
  class:warn={data.flagged}
  style:--c={`var(--kind-${data.kind})`}
  data-testid="piece"
  data-kind={data.kind}
>
  {#if hasInput}
    <Handle type="target" position={Position.Left} id={HANDLE.in} class="port" />
  {/if}
  <Handle type="source" position={Position.Right} id={HANDLE.out} class="port" />
  {#if data.returnAnchor}
    <Handle
      type="target"
      position={Position.Top}
      id={HANDLE.returnIn}
      isConnectable={false}
      class="golden"
    />
  {/if}
  {#if data.kind === NodeKind.Supervisor}
    <Handle
      type="source"
      position={Position.Top}
      id={HANDLE.returnOut}
      isConnectable={false}
      class="anchor"
    />
  {/if}
  <div class="kind">{NODE_KIND_LABEL[data.kind]}</div>
  <div class="name">{data.name}</div>
  <div class="summary">{summary}</div>
</div>

<style>
  .piece {
    width: 190px;
    background: #fff;
    border: 1px solid var(--line);
    border-top: 4px solid var(--c);
    border-radius: 5px;
    padding: 8px 10px;
    box-shadow: 0 2px 6px rgb(0 0 0 / 6%);
    text-align: left;
  }
  .piece.warn {
    box-shadow: 0 0 0 2px #e2b04a;
  }
  .piece.selected {
    outline: 2px solid var(--c);
    outline-offset: 2px;
  }
  .kind {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.14em;
    color: var(--c);
    text-transform: uppercase;
  }
  .name {
    font-weight: 600;
    font-size: 13px;
    margin: 2px 0;
    overflow-wrap: anywhere;
  }
  .summary {
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
