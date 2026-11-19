<script lang="ts">
  // Paleta (M1, FR-01): clique põe a peça no centro visível; arrastar solta na posição.
  import { NODE_KIND_LABEL, NodeKind } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { KIND_MIME } from './drag.ts';

  let { onadd }: { onadd: (kind: NodeKind) => void } = $props();

  const groups: readonly { title: string; kinds: readonly NodeKind[] }[] = [
    {
      title: ptBR.palette.pieces,
      kinds: [NodeKind.Input, NodeKind.Worker, NodeKind.Supervisor, NodeKind.Delivery],
    },
    { title: ptBR.palette.structure, kinds: [NodeKind.Decision, NodeKind.Memory] },
  ];

  function dragstart(event: DragEvent, kind: NodeKind) {
    event.dataTransfer?.setData(KIND_MIME, kind);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
</script>

<aside class="palette">
  {#each groups as group (group.title)}
    <div class="label">{group.title}</div>
    {#each group.kinds as kind (kind)}
      <button
        type="button"
        class="card"
        style:--c={`var(--kind-${kind})`}
        title={ptBR.palette.addHint}
        draggable="true"
        ondragstart={(event) => {
          dragstart(event, kind);
        }}
        onclick={() => {
          onadd(kind);
        }}
      >
        <b>{NODE_KIND_LABEL[kind]}</b>
        <span>{ptBR.palette.description[kind]}</span>
      </button>
    {/each}
  {/each}
  <div class="label">{ptBR.palette.shortcuts}</div>
  <p class="help">{ptBR.palette.shortcutsHelp}</p>
</aside>

<style>
  .palette {
    border-right: 1px solid var(--line);
    padding: 12px;
    overflow-y: auto;
    background: var(--paper2);
  }
  .label {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 14px;
  }
  .label:first-child {
    margin-top: 0;
  }
  .card {
    display: block;
    width: 100%;
    text-align: left;
    font: inherit;
    color: inherit;
    background: #fff;
    border: 1px solid var(--line);
    border-left: 4px solid var(--c);
    border-radius: 6px;
    padding: 8px 10px;
    margin: 6px 0 10px;
    cursor: grab;
  }
  .card:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
  .card b {
    font-size: 14px;
  }
  .card span {
    display: block;
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.35;
    margin-top: 2px;
  }
  .help {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
  }
</style>
