<script lang="ts">
  // Inspetor da peça (FR-11..15, M2–M5).
  import {
    BAR_PRESET_IDS,
    type GraphNode,
    NODE_KIND_LABEL,
    type NodeId,
    NodeKind,
    type OnExhausted,
  } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import type { Editor } from '#lib/state/editor.svelte.ts';
  import { connectionsOf } from './connections.ts';
  import Field from './Field.svelte';
  import { fieldError } from './field-error.ts';
  import Links from './Links.svelte';

  let {
    editor,
    node,
    onreveal,
  }: { editor: Editor; node: GraphNode; onreveal: (id: NodeId) => void } = $props();

  const t = ptBR.inspector;
  const links = $derived(connectionsOf(editor.graph, node.id));
  const end = () => {
    editor.endEdit();
  };
  let relationDraft = $state('');

  const instructionsLabel = $derived(node.kind === NodeKind.Supervisor ? t.bar : t.instructions);
  const placeholder = $derived(
    node.kind === NodeKind.Supervisor
      ? t.barPlaceholder
      : node.kind === NodeKind.Input
        ? t.inputPlaceholder
        : '',
  );

  function addRelation(relations: readonly string[]) {
    const value = relationDraft.trim();
    relationDraft = '';
    if (value.length > 0) editor.updateNode(node.id, { relations: [...relations, value] });
  }

  function relationKey(event: KeyboardEvent, relations: readonly string[]) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addRelation(relations);
    }
  }
</script>

<div class="head">
  <span class="badge" style:--c={`var(--kind-${node.kind})`}>{NODE_KIND_LABEL[node.kind]}</span>
  <button type="button" class="btn danger" onclick={() => editor.deleteSelection()}>
    {t.delete}
  </button>
</div>

{#key node.id}
  <Field
    id="node-name"
    label={t.nodeName}
    value={node.name}
    onedit={(name: string) => fieldError(editor.editNode(node.id, 'name', { name }))}
    onend={end}
  />
  <Field
    id="node-instructions"
    label={instructionsLabel}
    value={node.instructions}
    multiline
    {placeholder}
    onedit={(instructions: string) =>
      fieldError(editor.editNode(node.id, 'instructions', { instructions }))}
    onend={end}
  />
  <p class="help">{t.help[node.kind]}</p>

  {#if node.kind === NodeKind.Supervisor}
    <div class="quick">
      <div class="label quick-title">{t.quickFill}</div>
      {#each BAR_PRESET_IDS as preset (preset)}
        <button
          type="button"
          class="preset"
          class:on={node.presets.includes(preset)}
          aria-pressed={node.presets.includes(preset)}
          onclick={() => editor.togglePreset(node.id, preset)}
        >
          <b>{ptBR.presets[preset].label}</b>
          <span>{ptBR.presets[preset].description}</span>
        </button>
      {/each}
    </div>
    <div class="row">
      <Field
        id="node-max-rounds"
        label={t.maxRounds}
        type="number"
        value={String(node.maxRounds)}
        onedit={(text) =>
          fieldError(editor.editNode(node.id, 'maxRounds', { maxRounds: Number(text || 'NaN') }))}
        onend={end}
      />
      <div class="field">
        <label class="label" for="node-on-exhausted">{t.onExhausted}</label>
        <select
          id="node-on-exhausted"
          value={node.onExhausted}
          onchange={(event) =>
            editor.updateNode(node.id, {
              onExhausted: event.currentTarget.value as OnExhausted,
            })}
        >
          <option value="deliver-best-with-caveats"
            >{t.onExhaustedOption['deliver-best-with-caveats']}</option
          >
          <option value="fail">{t.onExhaustedOption.fail}</option>
        </select>
      </div>
    </div>
    <Links
      rows={[
        { label: t.judges, nodes: links.judges },
        { label: t.approved, nodes: links.sendsTo },
        { label: t.writesTo, nodes: links.writesTo },
        { label: t.readsFrom, nodes: links.readsFrom },
      ]}
      {onreveal}
    />
  {:else if node.kind === NodeKind.Decision}
    <Links
      rows={[
        { label: t.receivesFrom, nodes: links.receivesFrom },
        { label: t.writesTo, nodes: links.writesTo },
        { label: t.readsFrom, nodes: links.readsFrom },
      ]}
      {onreveal}
    />
    <div class="label paths">{t.paths}</div>
    {#each links.paths as path (path.edge.id)}
      <Field
        id={`condition-${path.edge.id}`}
        label={`→ ${path.target.name}`}
        value={path.edge.condition ?? ''}
        placeholder={t.conditionPlaceholder}
        warning={(path.edge.condition ?? '').trim() === '' ? t.conditionMissing : null}
        onedit={(text: string) => fieldError(editor.editCondition(path.edge.id, text))}
        onend={end}
      />
    {:else}
      <p class="help">{t.noPaths}</p>
    {/each}
  {:else if node.kind === NodeKind.Memory}
    <div class="field">
      <label class="label" for="node-relation">{t.relations}</label>
      <div class="chips">
        {#each node.relations as relation (relation)}
          <span class="chip"
            >{relation}<button
              type="button"
              aria-label={t.removeRelation(relation)}
              onclick={() =>
                editor.updateNode(node.id, {
                  relations: node.relations.filter((r) => r !== relation),
                })}>×</button
            ></span
          >
        {/each}
        <input
          id="node-relation"
          class="chip-input"
          placeholder={t.addRelation}
          bind:value={relationDraft}
          onkeydown={(event) => {
            relationKey(event, node.relations);
          }}
          onblur={() => {
            addRelation(node.relations);
          }}
        />
      </div>
    </div>
    <Links
      rows={[
        { label: t.writers, nodes: links.writers, required: true },
        { label: t.readers, nodes: links.readers, required: true },
      ]}
      {onreveal}
    />
  {:else}
    <Links
      rows={[
        { label: t.receivesFrom, nodes: links.receivesFrom },
        { label: t.sendsTo, nodes: links.sendsTo },
        { label: t.writesTo, nodes: links.writesTo },
        { label: t.readsFrom, nodes: links.readsFrom },
      ]}
      {onreveal}
    />
  {/if}
{/key}
