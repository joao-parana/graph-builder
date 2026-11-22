<script lang="ts">
  // Barra do topo (M1, M9): título editável (FR-33), "salvo" (FR-30), os botões dos modais e, com a
  // nuvem no build, "Onde salvar" e a conta (FR-50..53).
  import AccountButton from '#lib/account/AccountButton.svelte';
  import ModeSwitch from '#lib/account/ModeSwitch.svelte';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import Field from '#lib/inspector/Field.svelte';
  import type { ModalName } from '#lib/modals/modal-name.ts';
  import { fieldError } from '#lib/inspector/field-error.ts';
  import type { Editor } from '#lib/state/editor.svelte.ts';
  import type { Session } from '#lib/state/session.svelte.ts';
  import type { SaveStatus } from '#lib/state/workspace.svelte.ts';

  let {
    editor,
    status,
    session,
    onopen,
  }: {
    editor: Editor;
    status: SaveStatus;
    session: Session;
    onopen: (modal: ModalName) => void;
  } = $props();

  const t = ptBR.top;
  const statusText = $derived(
    status === 'saved' ? t.saved : status === 'saving' ? t.saving : t.unsaved,
  );
</script>

<header class="top">
  <span class="brand">◇ {ptBR.app.title}<small>{ptBR.app.brandNote}</small></span>
  <div class="title">
    <Field
      id="top-title"
      label={t.title}
      hideLabel
      value={editor.graph.name}
      onedit={(name: string) => fieldError(editor.editGraph('name', { name }))}
      onend={() => {
        editor.endEdit();
      }}
    />
    <span class="status" class:error={status === 'error'} data-testid="save-status" role="status"
      >{statusText}</span
    >
  </div>
  {#if session.cloudAvailable}
    <ModeSwitch {session} />
  {/if}
  <nav class="actions" aria-label="Arquivo">
    <button
      type="button"
      class="btn round"
      aria-label={t.help}
      title={t.help}
      onclick={() => {
        onopen('help');
      }}>?</button
    >
    <button
      type="button"
      class="btn"
      onclick={() => {
        onopen('library');
      }}>{t.library}</button
    >
    <button
      type="button"
      class="btn"
      onclick={() => {
        onopen('import');
      }}>{t.importJson}</button
    >
    <button
      type="button"
      class="btn"
      disabled={editor.graph.nodes.length === 0}
      onclick={() => {
        onopen('clear');
      }}>{t.clear}</button
    >
    <button
      type="button"
      class="btn primary"
      onclick={() => {
        onopen('export');
      }}>{t.export}</button
    >
  </nav>
  {#if session.cloudAvailable}
    <AccountButton {session} />
  {/if}
</header>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--line);
    background: var(--paper2);
  }
  .brand {
    font-family: var(--serif);
    font-size: 20px;
    white-space: nowrap;
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
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  .title :global(.field) {
    margin: 0;
    position: relative;
    /* Com o seletor de modo e a conta (M9), o título encolhe antes do "salvo". */
    flex: 0 1 240px;
    min-width: 0;
  }
  .title :global(input) {
    width: 100%;
    border-color: transparent;
    background: transparent;
    text-align: center;
    font-weight: 500;
    font-size: 15px;
  }
  .title :global(input:hover),
  .title :global(input:focus) {
    border-color: var(--line);
    background: #fff;
  }
  .title :global(.errbox) {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 30;
  }
  .status {
    flex: none;
    font: 11px var(--mono);
    color: var(--kind-delivery);
    white-space: nowrap;
  }
  .status.error {
    color: var(--kind-supervisor);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .round {
    width: 30px;
    padding: 6px 0;
    border-radius: 50%;
  }
</style>
