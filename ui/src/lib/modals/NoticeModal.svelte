<script lang="ts">
  // FR-51: aviso da volta do login. Não some sozinho; fecha em "Entendi", no ✕ ou com Esc.
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import Modal from '#lib/Modal.svelte';

  let { message, onclose }: { message: string; onclose: () => void } = $props();
</script>

<Modal title={ptBR.cloud.noticeTitle} narrow alert {onclose}>
  <p>{message}</p>
  {#snippet footer()}
    <button type="button" class="btn primary" onclick={onclose}>{ptBR.cloud.noticeOk}</button>
  {/snippet}
</Modal>
