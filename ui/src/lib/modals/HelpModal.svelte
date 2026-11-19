<script lang="ts">
  // FR-40: peças, "Como ligar" e atalhos.
  import { NODE_KIND_LABEL, NodeKind } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import Modal from '#lib/Modal.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const t = ptBR.help;
  const kinds = Object.values(NodeKind);
</script>

<Modal title={t.title} {onclose}>
  <h3 class="label">{t.pieces}</h3>
  <dl>
    {#each kinds as kind (kind)}
      <dt style:--c={`var(--kind-${kind})`}>{NODE_KIND_LABEL[kind]}</dt>
      <dd>{ptBR.palette.description[kind]}</dd>
    {/each}
  </dl>
  <h3 class="label">{t.howToLink}</h3>
  <ul>
    {#each t.howToLinkText as line (line)}
      <li>{line}</li>
    {/each}
  </ul>
  <h3 class="label">{t.shortcuts}</h3>
  <dl>
    {#each t.shortcutList as [keys, what] (keys)}
      <dt><kbd>{keys}</kbd></dt>
      <dd>{what}</dd>
    {/each}
  </dl>
</Modal>

<style>
  h3 {
    margin: 14px 0 6px;
  }
  h3:first-child {
    margin-top: 0;
  }
  dl {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: 13px;
  }
  dt {
    font-weight: 600;
    color: var(--c, var(--ink));
  }
  dd {
    margin: 0;
  }
  ul {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
  }
  kbd {
    font: 12px var(--mono);
  }
</style>
