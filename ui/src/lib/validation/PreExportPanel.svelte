<script lang="ts">
  // "Antes de exportar" (FR-20, M1): flutua no canto do canvas; some quando não há itens.
  import type { ValidationIssue } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import { issueMessage, visibleIssues } from './messages.ts';

  let {
    issues,
    onpick,
  }: { issues: readonly ValidationIssue[]; onpick: (issue: ValidationIssue) => void } = $props();

  const view = $derived(visibleIssues(issues));
  const hasErrors = $derived(issues.some((issue) => issue.level === 'error'));
</script>

{#if issues.length > 0}
  <section class="prexp" class:errors={hasErrors} aria-label={ptBR.validation.title}>
    <div class="label title">{ptBR.validation.title}</div>
    <ul>
      {#each view.shown as issue, index (index)}
        <li class:err={issue.level === 'error'} data-rule={issue.rule}>
          <button
            type="button"
            onclick={() => {
              onpick(issue);
            }}>{issueMessage(issue)}</button
          >
        </li>
      {/each}
      {#if view.hidden > 0}
        <li class="more">{ptBR.validation.more(view.hidden)}</li>
      {/if}
    </ul>
  </section>
{/if}
