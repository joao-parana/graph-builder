<script lang="ts">
  // Canvas (M1, FR-02..07, FR-09). O Svelte Flow só desenha: toda mudança passa pelo Editor.
  import {
    Background,
    BackgroundVariant,
    type Connection,
    type NodeTypes,
    SvelteFlow,
  } from '@xyflow/svelte';
  import { untrack } from 'svelte';
  import { edgeId, nodeId } from '@graph-builder/core';
  import { ptBR } from '#lib/i18n/pt-BR.ts';
  import type { Editor } from '#lib/state/editor.svelte.ts';
  import {
    isReturnWire,
    isValidWire,
    type PieceNode,
    toFlowEdges,
    toFlowNodes,
    type Wire,
  } from './mapping.ts';
  import PieceNodeView from './PieceNode.svelte';
  import ZoomBar from './ZoomBar.svelte';
  import { ZOOM_MAX, ZOOM_MIN } from './zoom.ts';

  let {
    editor,
    flagged,
    ondropkind,
  }: { editor: Editor; flagged: readonly string[]; ondropkind: (event: DragEvent) => void } =
    $props();

  const nodeTypes: NodeTypes = { piece: PieceNodeView };

  let nodes: PieceNode[] = $state.raw([]);
  let edges: Wire[] = $state.raw([]);
  /** Viewport salvo do grafo aberto; o canvas remonta a cada grafo aberto (FR-30). */
  const initial = untrack(() => editor.viewport);
  let zoom = $state(initial.zoom);

  $effect.pre(() => {
    nodes = toFlowNodes(editor.graph, editor.selectedNodeIds, flagged);
  });
  $effect.pre(() => {
    edges = toFlowEdges(editor.graph, editor.armedEdgeId);
  });

  function connect(connection: Connection): false {
    editor.connect(nodeId(connection.source), nodeId(connection.target));
    return false; // o fio entra pelo grafo, não pelo Svelte Flow
  }
</script>

<div
  class="canvas"
  role="application"
  aria-label={ptBR.canvas.label}
  ondragover={(event) => {
    event.preventDefault();
  }}
  ondrop={ondropkind}
>
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    minZoom={ZOOM_MIN}
    maxZoom={ZOOM_MAX}
    snapGrid={editor.snap ? [16, 16] : undefined}
    deleteKey={null}
    zoomOnDoubleClick={false}
    proOptions={{ hideAttribution: true }}
    isValidConnection={(connection) => isValidWire(editor.graph, connection)}
    onbeforeconnect={connect}
    onedgeclick={({ edge }) => {
      if (!isReturnWire(edge.id)) editor.clickEdge(edgeId(edge.id));
    }}
    onpaneclick={() => {
      editor.disarm();
    }}
    onnodeclick={() => {
      editor.disarm();
    }}
    onselectionchange={({ nodes: chosen }) => {
      editor.select(chosen.map((n) => nodeId(n.id)));
    }}
    onnodedragstop={({ nodes: dragged }) =>
      editor.moveNodes(dragged.map((n) => ({ id: nodeId(n.id), position: n.position })))}
    initialViewport={initial}
    onmove={(_, viewport) => (zoom = viewport.zoom)}
    onmoveend={(_, viewport) => {
      editor.viewport = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
    }}
  >
    <Background
      variant={BackgroundVariant.Dots}
      gap={16}
      size={1}
      bgColor="var(--paper)"
      patternColor="#CFC6B5"
    />
    <ZoomBar {editor} {zoom} />
  </SvelteFlow>
</div>

<style>
  .canvas {
    position: relative;
    height: 100%;
    min-height: 0;
  }
</style>
