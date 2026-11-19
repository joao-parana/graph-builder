<script lang="ts">
  // FR-32: confirmação do Limpar (desfazível).
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import Modal from '#lib/Modal.svelte';

  let { onclose, onconfirm }: { onclose: () => void; onconfirm: () => void } = $props();
</script>

<Modal title={ptBR.clear.title} narrow {onclose}>
  <p>{ptBR.clear.message}</p>
  <p class="muted">{ptBR.clear.hint}</p>
  {#snippet footer()}
    <button type="button" class="btn" onclick={onclose}>{ptBR.modal.cancel}</button>
    <button type="button" class="btn primary" onclick={onconfirm}>{ptBR.clear.confirm}</button>
  {/snippet}
</Modal>
