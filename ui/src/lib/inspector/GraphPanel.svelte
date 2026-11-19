<script lang="ts">
  // Inspetor do Grafo (FR-10, M1).
  import { NodeKind } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import type { Editor } from '#lib/state/editor.svelte.ts';
  import Field from './Field.svelte';
  import { fieldError } from './field-error.ts';
  import { summaryOf } from './connections.ts';

  let { editor }: { editor: Editor } = $props();

  const summary = $derived(summaryOf(editor.graph));
  const count = (kind: NodeKind) => {
    const n = summary.counts[kind] ?? 0;
    const [one, many] = ptBR.inspector.count[kind];
    return `${String(n)} ${n === 1 ? one : many}`;
  };
  const lines = [
    [NodeKind.Input, NodeKind.Worker, NodeKind.Supervisor],
    [NodeKind.Delivery, NodeKind.Decision, NodeKind.Memory],
  ] as const;
</script>

<span class="badge" style:--c="var(--ink)">{ptBR.inspector.graphBadge}</span>
<Field
  id="graph-name"
  label={ptBR.inspector.graphName}
  value={editor.graph.name}
  onedit={(name: string) => fieldError(editor.editGraph('name', { name }))}
  onend={() => {
    editor.endEdit();
  }}
/>
<Field
  id="graph-objective"
  label={ptBR.inspector.objective}
  value={editor.graph.objective}
  multiline
  onedit={(objective: string) => fieldError(editor.editGraph('objective', { objective }))}
  onend={() => {
    editor.endEdit();
  }}
/>
<p class="help">{ptBR.inspector.objectiveHelp}</p>
<div class="field">
  <span class="label">{ptBR.inspector.summary}</span>
  <div class="summary" data-testid="graph-summary">
    {#each lines as line, index (index)}
      <div>{line.map(count).join(' · ')}</div>
    {/each}
    <div class="muted">
      {ptBR.inspector.wires(summary.wires)} · {ptBR.inspector.loops(summary.loops)}
    </div>
  </div>
</div>
