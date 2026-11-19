<script lang="ts">
  // Modal (FR-21, FR-22, FR-31, FR-32, FR-40): <dialog> nativo. Esc e ✕ fecham; o foco volta ao
  // elemento que abriu.
  import type { Snippet } from 'svelte';
  import { ptBR } from '#lib/i18n/pt-BR.ts';

  let {
    title,
    narrow = false,
    onclose,
    children,
    footer,
  }: {
    title: string;
    narrow?: boolean;
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  const titleId = `modal-title-${Math.random().toString(36).slice(2)}`;

  $effect(() => {
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  });
</script>

<dialog
  class="modal"
  class:narrow
  bind:this={dialog}
  aria-labelledby={titleId}
  oncancel={(event) => {
    event.preventDefault();
    onclose();
  }}
>
  <header class="modal-head">
    <h2 id={titleId}>{title}</h2>
    <button type="button" class="icon-btn" aria-label={ptBR.modal.close} onclick={onclose}>✕</button
    >
  </header>
  <div class="modal-body">
    {@render children()}
  </div>
  {#if footer}
    <footer class="modal-foot">
      {@render footer()}
    </footer>
  {/if}
</dialog>
