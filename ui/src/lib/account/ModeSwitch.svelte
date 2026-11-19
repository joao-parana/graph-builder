<script lang="ts">
  // FR-53 (M9): "Onde salvar" — Neste navegador | Na nuvem. A nuvem só com sessão.
  import type { StorageMode } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import type { Session } from '#lib/state/session.svelte.ts';

  let { session }: { session: Session } = $props();

  const t = ptBR.cloud;
  const modes: readonly StorageMode[] = ['local', 'cloud'];
  let busy = $state(false);

  async function pick(mode: StorageMode) {
    busy = true;
    try {
      await session.switchMode(mode);
    } finally {
      busy = false;
    }
  }
</script>

<span class="wrap">
  <span class="seg" role="radiogroup" aria-label={t.where}>
    {#each modes as mode (mode)}
      {@const locked = mode === 'cloud' && session.account === null}
      <button
        type="button"
        role="radio"
        aria-checked={session.mode === mode}
        aria-describedby={locked ? 'mode-tip' : undefined}
        class:on={session.mode === mode}
        disabled={locked || busy}
        onclick={() => void pick(mode)}>{t.modes[mode]}</button
      >
    {/each}
  </span>
  {#if session.account === null}
    <span class="tip" id="mode-tip" role="tooltip">{t.needsSignIn}</span>
  {/if}
</span>

<style>
  .wrap {
    position: relative;
    display: inline-flex;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    background: #fff;
  }
  button {
    padding: 6px 10px;
    border: 0;
    border-right: 1px solid var(--line);
    background: transparent;
    font: 12.5px var(--sans);
    color: var(--muted);
    white-space: nowrap;
    cursor: pointer;
  }
  button:last-child {
    border-right: 0;
  }
  button.on {
    background: var(--ink);
    color: #fff;
  }
  button:disabled:not(.on) {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .tip {
    display: none;
    position: absolute;
    left: 50%;
    top: calc(100% + 8px);
    transform: translateX(-50%);
    z-index: 40;
    background: var(--ink);
    color: #fff;
    font-size: 11.5px;
    border-radius: 5px;
    padding: 5px 8px;
    white-space: nowrap;
  }
  .wrap:hover .tip,
  .wrap:focus-within .tip {
    display: block;
  }
</style>
