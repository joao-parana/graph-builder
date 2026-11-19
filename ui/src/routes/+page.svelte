<script lang="ts">
  import '@xyflow/svelte/dist/style.css';
  import '#lib/theme.css';
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import EditorView from '#lib/EditorView.svelte';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
</script>

<svelte:head>
  <title>{ptBR.app.title}</title>
</svelte:head>

<SvelteFlowProvider>
  <EditorView />
</SvelteFlowProvider>
