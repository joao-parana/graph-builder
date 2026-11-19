<script lang="ts">
  // M7 "Meus grafos" (FR-31): abrir, renomear na linha, duplicar e apagar com confirmação.
  // M10 (v2, FR-53, FR-54): o título diz o modo; com a cópia entre modos, as outras ações vão
  // para o menu "⋯".
  import type { GraphId } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { fieldError } from '#lib/inspector/field-error.ts';
  import { formatUpdated } from '#lib/library/when.ts';
  import Modal from '#lib/Modal.svelte';
  import type { Session } from '#lib/state/session.svelte.ts';
  import type { Workspace } from '#lib/state/workspace.svelte.ts';

  let {
    workspace,
    session,
    onclose,
  }: { workspace: Workspace; session: Session; onclose: () => void } = $props();

  const t = ptBR.library;
  const c = ptBR.cloud;
  const title = $derived(session.cloudAvailable ? c.libraryTitle[session.mode] : t.title);
  const copyTarget = $derived(session.copyTarget);
  let menuFor: GraphId | null = $state(null);
  const now = new Date();
  let renaming: GraphId | null = $state(null);
  let draft = $state('');
  let renameError: string | null = $state(null);
  let deleting: GraphId | null = $state(null);

  $effect(() => {
    void workspace.refresh();
  });

  function startRename(id: GraphId, name: string) {
    menuFor = null;
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

  function menuKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && menuFor !== null) {
      event.preventDefault();
      event.stopPropagation();
      menuFor = null;
    }
  }

  const focusOnMount = (node: HTMLInputElement) => {
    node.focus();
    node.select();
  };
</script>

{#snippet rowActions(id: GraphId, name: string)}
  <button
    type="button"
    class="btn link"
    role={menuFor === id ? 'menuitem' : undefined}
    onclick={() => {
      startRename(id, name);
    }}>{t.rename}</button
  >
  <button
    type="button"
    class="btn link"
    role={menuFor === id ? 'menuitem' : undefined}
    onclick={() => {
      menuFor = null;
      void workspace.duplicate(id);
    }}>{t.duplicate}</button
  >
  <button
    type="button"
    class="btn link danger"
    role={menuFor === id ? 'menuitem' : undefined}
    onclick={() => {
      menuFor = null;
      renaming = null;
      deleting = id;
    }}>{t.delete}</button
  >
{/snippet}

<Modal {title} {onclose}>
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
                {#if copyTarget !== null}
                  <button
                    type="button"
                    class="btn link"
                    onclick={() => void session.copyTo(item.id)}>{c.copyTo[copyTarget]}</button
                  >
                  <span class="more">
                    <button
                      type="button"
                      class="btn link"
                      aria-label={c.moreActions}
                      title={c.moreActions}
                      aria-haspopup="menu"
                      aria-expanded={menuFor === item.id}
                      onclick={() => (menuFor = menuFor === item.id ? null : item.id)}>⋯</button
                    >
                    {#if menuFor === item.id}
                      <div class="menu" role="menu" tabindex="-1" onkeydown={menuKey}>
                        {@render rowActions(item.id, item.name)}
                      </div>
                    {/if}
                  </span>
                {:else}
                  {@render rowActions(item.id, item.name)}
                {/if}
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
  .more {
    position: relative;
    display: inline-block;
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 2px);
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 130px;
    padding: 4px;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 8px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
  }
  .menu :global(.btn) {
    text-align: left;
  }
  .rename {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--line);
    border-radius: 4px;
    font: inherit;
  }
</style>
