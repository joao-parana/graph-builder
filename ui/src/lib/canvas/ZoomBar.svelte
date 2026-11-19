<script lang="ts">
  // Rodapé do canvas (FR-06, FR-07): zoom −/%/+, Enquadrar, Arrumar, Grade, Foco.
  import { tick } from 'svelte';
  import { Panel, useSvelteFlow } from '@xyflow/svelte';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import type { Editor } from '#lib/state/editor.svelte.ts';
  import { nextZoom, ZOOM_MAX, ZOOM_MIN } from './zoom.ts';

  let { editor, zoom }: { editor: Editor; zoom: number } = $props();
  const flow = useSvelteFlow();
  const percent = $derived(Math.round(zoom * 100));

  const step = (direction: 1 | -1) => void flow.setZoom(nextZoom(zoom, direction));
  /** Enquadrar sem passar de 100%: poucas peças não viram um close de 200%. */
  const fit = () => void flow.fitView({ padding: 0.2, maxZoom: 1 });
  const arrange = async () => {
    if (!editor.arrange()) return;
    await tick(); // espera o Svelte Flow receber as posições novas
    requestAnimationFrame(fit);
  };
</script>

<Panel position="bottom-left" class="zoombar">
  <button
    type="button"
    aria-label={ptBR.canvas.zoomOut}
    disabled={zoom <= ZOOM_MIN}
    onclick={() => {
      step(-1);
    }}>−</button
  >
  <span class="value" data-testid="zoom">{percent}%</span>
  <button
    type="button"
    aria-label={ptBR.canvas.zoomIn}
    disabled={zoom >= ZOOM_MAX}
    onclick={() => {
      step(1);
    }}>+</button
  >
  <button type="button" onclick={fit}>{ptBR.canvas.fit}</button>
  <button type="button" onclick={() => void arrange()}>{ptBR.canvas.arrange}</button>
  <button type="button" aria-pressed={editor.snap} onclick={() => (editor.snap = !editor.snap)}>
    {ptBR.canvas.grid}
  </button>
  <button type="button" aria-pressed={editor.focus} onclick={() => (editor.focus = !editor.focus)}>
    {ptBR.canvas.focus}
  </button>
</Panel>
