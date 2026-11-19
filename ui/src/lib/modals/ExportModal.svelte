<script lang="ts">
  // M6 "Exportar para a IA" (FR-21): abas Prompt e JSON; com erros, o prompt fica bloqueado.
  import {
    exportJson,
    exportPrompt,
    type Graph,
    jsonGraphCodec,
    markdownPromptRenderer,
    validateGraph,
  } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { downloadText, fileName, MIME } from '#lib/io/files.ts';
  import Modal from '#lib/Modal.svelte';
  import { issueMessage } from '#lib/validation/messages.ts';

  let {
    graph,
    onclose,
    onnotify,
  }: { graph: Graph; onclose: () => void; onnotify: (message: string) => void } = $props();

  const t = ptBR.exporter;
  let tab = $state<'prompt' | 'json'>('prompt');
  const prompt = $derived(exportPrompt(graph, markdownPromptRenderer));
  const json = $derived(exportJson(graph, jsonGraphCodec));
  const warnings = $derived(validateGraph(graph).filter((i) => i.level === 'warning').length);
  const text = $derived(tab === 'json' ? json : prompt.ok ? prompt.value : null);

  async function copy() {
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      onnotify(t.copied);
    } catch {
      onnotify(t.copyFailed);
    }
  }

  function download() {
    if (text === null) return;
    const extension = tab === 'json' ? 'json' : 'md';
    downloadText(text, fileName(graph.name, extension), MIME[extension]);
  }

  function key(event: KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      tab = tab === 'prompt' ? 'json' : 'prompt';
      document.getElementById(`export-tab-${tab}`)?.focus();
    }
  }
</script>

<Modal title={t.title} {onclose}>
  <div class="tabs" role="tablist" tabindex="-1" onkeydown={key}>
    {#each [['prompt', t.promptTab], ['json', t.jsonTab]] as const as [id, label] (id)}
      <button
        type="button"
        role="tab"
        id={`export-tab-${id}`}
        aria-selected={tab === id}
        aria-controls="export-panel"
        tabindex={tab === id ? 0 : -1}
        onclick={() => (tab = id)}>{label}</button
      >
    {/each}
  </div>
  <div id="export-panel" role="tabpanel" aria-labelledby={`export-tab-${tab}`}>
    {#if text !== null}
      <pre class="code" data-testid="export-text">{text}</pre>
    {:else if !prompt.ok}
      <div class="blocked" data-testid="export-blocked">
        <p>{t.blocked}</p>
        <ul>
          {#each prompt.error as issue, index (index)}
            <li>{issueMessage(issue)}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <span class="note">{t.warnings(warnings)}</span>
    <button type="button" class="btn" disabled={text === null} onclick={download}>
      {tab === 'json' ? t.downloadJson : t.downloadMd}
    </button>
    <button type="button" class="btn primary" disabled={text === null} onclick={() => void copy()}>
      {tab === 'json' ? t.copyJson : t.copyPrompt}
    </button>
  {/snippet}
</Modal>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }
  [role='tab'] {
    border: none;
    background: none;
    padding: 6px 12px;
    font: 13px var(--sans);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    color: var(--muted);
  }
  [role='tab'][aria-selected='true'] {
    border-bottom-color: var(--ink);
    color: var(--ink);
  }
  .code {
    margin: 0;
    padding: 12px;
    max-height: 52vh;
    overflow: auto;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 6px;
    font: 12px/1.5 var(--mono);
    white-space: pre-wrap;
  }
  .blocked {
    color: var(--kind-supervisor);
    font-size: 13px;
  }
</style>
