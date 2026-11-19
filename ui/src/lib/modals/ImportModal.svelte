<script lang="ts">
  // M8 "Abrir JSON" (FR-22): arquivo (arrastar ou escolher) ou texto colado. Nada é aberto até o
  // JSON passar no schema e nos invariantes.
  import { type EditContext, type Graph, importJson, jsonGraphCodec } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { type ImportProblem, importProblems } from '#lib/io/import-problems.ts';
  import Modal from '#lib/Modal.svelte';

  let {
    ctx,
    onclose,
    onimport,
  }: { ctx: EditContext; onclose: () => void; onimport: (graph: Graph) => void } = $props();

  const t = ptBR.importer;
  let text = $state('');
  let problems: readonly ImportProblem[] = $state.raw([]);
  let over = $state(false);
  let picker: HTMLInputElement | undefined = $state();

  async function load(file: File | undefined) {
    if (file === undefined) return;
    try {
      text = await file.text();
      problems = [];
    } catch {
      problems = [{ path: file.name, message: t.readFailed }];
    }
  }

  function submit() {
    const result = importJson(ctx, text, jsonGraphCodec);
    if (result.ok) onimport(result.value);
    else problems = importProblems(text, result.error);
  }
</script>

<Modal title={t.title} {onclose}>
  <div
    class="drop"
    class:over
    role="presentation"
    ondragover={(event) => {
      event.preventDefault();
      over = true;
    }}
    ondragleave={() => (over = false)}
    ondrop={(event) => {
      event.preventDefault();
      over = false;
      void load(event.dataTransfer?.files[0]);
    }}
  >
    <p>{t.drop}</p>
    <button type="button" class="btn" onclick={() => picker?.click()}>{t.choose}</button>
    <input
      bind:this={picker}
      type="file"
      accept=".json,application/json"
      hidden
      data-testid="import-file"
      onchange={(event) => void load(event.currentTarget.files?.[0])}
    />
  </div>
  <label class="label" for="import-text">{t.text}</label>
  <textarea
    id="import-text"
    spellcheck="false"
    bind:value={text}
    oninput={() => (problems = [])}
    aria-invalid={problems.length > 0}
    aria-describedby={problems.length > 0 ? 'import-problems' : undefined}></textarea>
  {#if problems.length > 0}
    <div class="problems" id="import-problems" role="alert">
      <p>{t.problems(problems.length)}</p>
      <ul>
        {#each problems as problem, index (index)}
          <li><code>{problem.path}</code>: {problem.message}</li>
        {/each}
      </ul>
    </div>
  {/if}
  {#snippet footer()}
    <button type="button" class="btn" onclick={onclose}>{ptBR.modal.cancel}</button>
    <button type="button" class="btn primary" disabled={text.trim() === ''} onclick={submit}>
      {t.open}
    </button>
  {/snippet}
</Modal>

<style>
  .drop {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    margin-bottom: 12px;
    border: 1.5px dashed var(--line);
    border-radius: 8px;
    font-size: 13px;
    color: var(--muted);
  }
  .drop p {
    flex: 1;
    margin: 0;
  }
  .drop.over {
    border-color: var(--kind-worker);
    background: #fff;
  }
  textarea {
    display: block;
    width: 100%;
    min-height: 180px;
    margin-top: 4px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 6px;
    font: 12px/1.5 var(--mono);
    resize: vertical;
  }
  .problems {
    margin-top: 10px;
    color: var(--kind-supervisor);
    font-size: 13px;
  }
  .problems p {
    margin: 0 0 4px;
    font-weight: 600;
  }
  .problems ul {
    margin: 0;
    padding-left: 18px;
  }
</style>
