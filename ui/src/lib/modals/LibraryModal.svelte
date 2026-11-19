<script lang="ts">
  // M7 "Meus grafos" (FR-31): abrir, renomear na linha, duplicar e apagar com confirmação.
  import type { GraphId } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { fieldError } from '#lib/inspector/field-error.ts';
  import { formatUpdated } from '#lib/library/when.ts';
  import Modal from '#lib/Modal.svelte';
  import type { Workspace } from '#lib/state/workspace.svelte.ts';

  let { workspace, onclose }: { workspace: Workspace; onclose: () => void } = $props();

  const t = ptBR.library;
  const now = new Date();
  let renaming: GraphId | null = $state(null);
  let draft = $state('');
  let renameError: string | null = $state(null);
  let deleting: GraphId | null = $state(null);

  $effect(() => {
    void workspace.refresh();
  });

  function startRename(id: GraphId, name: string) {
    deleting = null;
    renaming = id;
    draft = name;
    renameError = null;
  }

  async function saveRename(id: GraphId) {
    const error = await workspace.rename(id, draft);
    renameError = fieldError(error);
    if (error === null) renaming = null;
  }

  function renameKey(event: KeyboardEvent, id: GraphId) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveRename(id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      renaming = null;
    }
  }

  async function open(id: GraphId) {
    if (await workspace.open(id)) onclose();
  }

  async function newGraph() {
    await workspace.newGraph();
    onclose();
  }

  const focusOnMount = (node: HTMLInputElement) => {
    node.focus();
    node.select();
  };
</script>

<Modal title={t.title} {onclose}>
  {#if workspace.graphs.length === 0}
    <p class="muted">{t.empty}</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th scope="col">{t.name}</th>
          <th scope="col" class="num">{t.pieces}</th>
          <th scope="col">{t.updated}</th>
          <th scope="col"><span class="sr-only">{t.actions}</span></th>
        </tr>
      </thead>
      <tbody>
        {#each workspace.graphs as item (item.id)}
          <tr class:current={item.id === workspace.currentId} data-testid="library-row">
            <td>
              {#if renaming === item.id}
                <input
                  class="rename"
                  aria-label={t.renameLabel(item.name)}
                  bind:value={draft}
                  aria-invalid={renameError !== null}
                  onkeydown={(event) => {
                    renameKey(event, item.id);
                  }}
                  use:focusOnMount
                />
                {#if renameError !== null}
                  <div class="errbox" role="alert">{renameError}</div>
                {/if}
              {:else}
                {item.name}
                {#if item.id === workspace.currentId}<small class="muted">· {t.current}</small>{/if}
              {/if}
            </td>
            <td class="num">{item.nodeCount}</td>
            <td>{formatUpdated(item.updatedAt, now, t)}</td>
            <td class="actions">
              {#if deleting === item.id}
                <button
                  type="button"
                  class="btn link danger"
                  onclick={() => {
                    deleting = null;
                    void workspace.remove(item.id);
                  }}>{t.confirmDelete}</button
                >
                <button type="button" class="btn link" onclick={() => (deleting = null)}
                  >{ptBR.modal.cancel}</button
                >
              {:else}
                <button type="button" class="btn link" onclick={() => void open(item.id)}
                  >{t.open}</button
                >
                <button
                  type="button"
                  class="btn link"
                  onclick={() => {
                    startRename(item.id, item.name);
                  }}>{t.rename}</button
                >
                <button
                  type="button"
                  class="btn link"
                  onclick={() => void workspace.duplicate(item.id)}>{t.duplicate}</button
                >
                <button
                  type="button"
                  class="btn link danger"
                  onclick={() => {
                    renaming = null;
                    deleting = item.id;
                  }}>{t.delete}</button
                >
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  {#snippet footer()}
    <button type="button" class="btn primary" onclick={() => void newGraph()}>{t.newGraph}</button>
  {/snippet}
</Modal>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    font: 10.5px var(--mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 6px 8px;
    border-bottom: 1px solid var(--line);
  }
  td {
    padding: 8px;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  tr.current td {
    background: #fff;
  }
  .num {
    text-align: right;
  }
  .actions {
    white-space: nowrap;
    text-align: right;
  }
  .rename {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--line);
    border-radius: 4px;
    font: inherit;
  }
</style>
