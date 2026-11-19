<script lang="ts">
  // Aviso curto (FR-01, FR-08): some sozinho depois de 3 s.
  import type { Toast } from '#lib/state/editor.svelte.ts';

  let { toast, ondismiss }: { toast: Toast | null; ondismiss: () => void } = $props();

  $effect(() => {
    if (toast === null) return;
    const timer = setTimeout(ondismiss, 3000);
    return () => {
      clearTimeout(timer);
    };
  });
</script>

<div class="toast-region" role="status" aria-live="polite">
  {#if toast}
    {#key toast.id}
      <div class="toast" data-testid="toast">{toast.message}</div>
    {/key}
  {/if}
</div>

<style>
  .toast-region {
    position: fixed;
    top: 64px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    pointer-events: none;
  }
  .toast {
    background: var(--ink);
    color: #fff;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    box-shadow: 0 6px 18px rgb(0 0 0 / 20%);
  }
</style>
