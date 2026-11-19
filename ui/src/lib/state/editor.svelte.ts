// Estado do editor (ADR-0003, item 4): runes em volta dos casos de uso do core. A UI nunca muta o
// Graph: cada ação chama um caso de uso e grava o resultado no histórico (FR-08).
import {
  addNode,
  amend,
  type BarPresetId,
  autoLayout,
  canRedo,
  canUndo,
  clearGraph,
  connectNodes,
  createGraph,
  dagreLayoutEngine,
  deleteNode,
  disconnectEdge,
  DUPLICATE_OFFSET,
  duplicateNode,
  type DomainError,
  type EdgeId,
  type EditContext,
  type EditResult,
  type Graph,
  GRID_SIZE,
  type History,
  type LayoutEngine,
  moveNode,
  type NodePatch,
  setEdgeCondition,
  toggleBarPreset,
  updateGraph,
  updateNode,
  type NodeId,
  type NodeKind,
  ok,
  type Position,
  randomIds,
  record,
  redo,
  startHistory,
  systemClock,
  undo,
} from '@graph-builder/core';
import { ptBR } from '#lib/i18n/pt-BR.ts';

export interface Toast {
  /** Muda a cada aviso, para repetir o mesmo texto. */
  readonly id: number;
  readonly message: string;
}

export interface Move {
  readonly id: NodeId;
  readonly position: Position;
}

const snapTo = (value: number): number => Math.round(value / GRID_SIZE) * GRID_SIZE;

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

export type Viewport = Graph['viewport'];

export class Editor {
  /** Público: a biblioteca (FR-31) usa o mesmo relógio e gerador de ids. */
  readonly ctx: EditContext;
  private readonly layoutEngine: LayoutEngine;

  history: History;
  selectedNodeIds: readonly NodeId[] = $state.raw([]);
  /** Fio no 1º passo do corte (FR-03). */
  armedEdgeId: EdgeId | null = $state(null);
  /** FR-06: snap na grade de 16 px, ligado por padrão. */
  snap = $state(true);
  /** FR-07: Foco oculta paleta e inspetor. */
  focus = $state(false);
  toast: Toast | null = $state(null);
  /** FR-30: pan/zoom do canvas; salvo com o grafo, fora do desfazer. */
  viewport: Viewport = $state.raw({ x: 0, y: 0, zoom: 1 });
  /** Muda a cada `load`: o canvas reaplica o viewport salvo. */
  loads = $state(0);

  /** O que o salvamento automático grava (FR-30). */
  get snapshot(): Graph {
    const graph = this.graph;
    const v = this.viewport;
    const same =
      graph.viewport.x === v.x && graph.viewport.y === v.y && graph.viewport.zoom === v.zoom;
    return same ? graph : { ...graph, viewport: v };
  }

  /** Getters leem `history` ($state.raw): continuam reativos. */
  get graph(): Graph {
    return this.history.present;
  }

  get canUndo(): boolean {
    return canUndo(this.history);
  }

  get canRedo(): boolean {
    return canRedo(this.history);
  }

  constructor(
    ctx: EditContext = { clock: systemClock, ids: randomIds },
    layoutEngine: LayoutEngine = dagreLayoutEngine,
  ) {
    this.ctx = ctx;
    this.layoutEngine = layoutEngine;
    this.history = $state.raw(startHistory(createGraph(ctx)));
  }

  notify(message: string): void {
    this.toast = { id: (this.toast?.id ?? 0) + 1, message };
  }

  private refuse(error: DomainError): false {
    this.notify(ptBR.errors[error.code]);
    return false;
  }

  /** Grava o resultado como um passo; comando recusado vira toast (FR-08). */
  /** Campo em edição: as edições seguintes dele emendam o mesmo passo (FR-08, L05). */
  private editKey: string | null = null;

  private commit(result: EditResult): boolean {
    if (!result.ok) return this.refuse(result.error);
    this.editKey = null;
    this.history = record(this.history, result.value);
    return true;
  }

  /** Vários comandos num passo só de desfazer; para no primeiro recusado. */
  private commitAll<T>(items: readonly T[], step: (graph: Graph, item: T) => EditResult): boolean {
    let result: EditResult = ok(this.graph);
    for (const item of items) {
      if (!result.ok) break;
      result = step(result.value, item);
    }
    return this.commit(result);
  }

  /** FR-01: no clique, desce +32 px enquanto o ponto estiver ocupado. */
  freePosition(position: Position): Position {
    const taken = (p: Position) =>
      this.graph.nodes.some((n) => n.position.x === p.x && n.position.y === p.y);
    let next = { x: snapTo(position.x), y: snapTo(position.y) };
    while (taken(next)) {
      next = { x: next.x + DUPLICATE_OFFSET, y: next.y + DUPLICATE_OFFSET };
    }
    return next;
  }

  /** FR-01. A peça nova fica selecionada. */
  addNode(kind: NodeKind, position: Position): boolean {
    const done = this.commit(addNode(this.ctx, this.graph, { kind, position }));
    if (done) this.selectLast();
    return done;
  }

  /** FR-02. */
  connect(source: NodeId, target: NodeId): boolean {
    return this.commit(connectNodes(this.ctx, this.graph, { source, target }));
  }

  /** FR-03: 1º clique arma o fio; 2º clique no mesmo fio corta. */
  clickEdge(id: EdgeId): void {
    if (this.armedEdgeId === id) this.cutArmedEdge();
    else {
      this.armedEdgeId = id;
      this.select([]);
    }
  }

  cutArmedEdge(): boolean {
    const id = this.armedEdgeId;
    if (id === null) return false;
    this.armedEdgeId = null;
    return this.commit(disconnectEdge(this.ctx, this.graph, id));
  }

  disarm(): void {
    this.armedEdgeId = null;
  }

  select(ids: readonly NodeId[]): void {
    if (sameIds(ids, this.selectedNodeIds)) return;
    this.selectedNodeIds = ids;
    if (ids.length > 0) this.armedEdgeId = null;
  }

  private selectLast(): void {
    const last = this.graph.nodes.at(-1);
    this.select(last === undefined ? [] : [last.id]);
  }

  /** Del/Backspace (FR-03, FR-04): corta o fio armado ou apaga as peças selecionadas. */
  deleteSelection(): boolean {
    if (this.armedEdgeId !== null) return this.cutArmedEdge();
    const ids = this.selectedNodeIds;
    if (ids.length === 0) return false;
    const done = this.commitAll(ids, (graph, id) => deleteNode(this.ctx, graph, id));
    if (done) this.select([]);
    return done;
  }

  /** FR-05: as cópias ficam selecionadas. */
  duplicateSelection(): boolean {
    const ids = this.selectedNodeIds;
    if (ids.length === 0) return false;
    const before = this.graph.nodes.length;
    const done = this.commitAll(ids, (graph, id) => duplicateNode(this.ctx, graph, id));
    if (done) this.select(this.graph.nodes.slice(before).map((node) => node.id));
    return done;
  }

  /** FR-06: chamado ao soltar; todas as peças arrastadas num passo só. */
  moveNodes(moves: readonly Move[]): boolean {
    return this.commitAll(moves, (graph, move) =>
      moveNode(this.ctx, graph, move.id, move.position, { snap: this.snap }),
    );
  }

  /** FR-07 Arrumar. */
  arrange(): boolean {
    return this.commit(autoLayout(this.ctx, this.graph, this.layoutEngine));
  }

  /**
   * Edição de um campo de texto (FR-10..14). A 1ª edição de `key` abre um passo; as seguintes o
   * emendam. Recusa não vira toast: o campo mostra o erro (devolvido aqui).
   */
  private edit(key: string, result: EditResult): DomainError | null {
    if (!result.ok) return result.error;
    if (result.value === this.graph) return null;
    this.history =
      this.editKey === key ? amend(this.history, result.value) : record(this.history, result.value);
    this.editKey = key;
    return null;
  }

  /** O campo perdeu o foco: a próxima edição abre outro passo. */
  endEdit(): void {
    this.editKey = null;
  }

  /** FR-11..15: nome, instruções, rodadas. `field` separa os passos de desfazer. */
  editNode(id: NodeId, field: keyof NodePatch, patch: NodePatch): DomainError | null {
    return this.edit(`node:${id}:${field}`, updateNode(this.ctx, this.graph, id, patch));
  }

  /** FR-10: nome e objetivo do grafo. */
  editGraph(
    field: 'name' | 'objective',
    patch: { name?: string; objective?: string },
  ): DomainError | null {
    return this.edit(`graph:${field}`, updateGraph(this.ctx, this.graph, patch));
  }

  /** FR-13. */
  editCondition(id: EdgeId, condition: string): DomainError | null {
    return this.edit(`edge:${id}`, setEdgeCondition(this.ctx, this.graph, id, condition));
  }

  /** Mudança discreta (select, chip, preset): um passo por clique. */
  updateNode(id: NodeId, patch: NodePatch): boolean {
    return this.commit(updateNode(this.ctx, this.graph, id, patch));
  }

  /** FR-12. */
  togglePreset(id: NodeId, preset: BarPresetId): boolean {
    return this.commit(toggleBarPreset(this.ctx, this.graph, id, preset));
  }

  /** FR-32: um passo de desfazer. */
  clear(): boolean {
    const done = this.commit(clearGraph(this.ctx, this.graph));
    if (done) this.select([]);
    return done;
  }

  /** FR-30, FR-31: troca o grafo aberto; o histórico recomeça. */
  load(graph: Graph): void {
    this.history = startHistory(graph);
    this.editKey = null;
    this.armedEdgeId = null;
    this.selectedNodeIds = [];
    this.viewport = graph.viewport;
    this.loads += 1;
  }

  /** FR-08. */
  undo(): void {
    this.editKey = null;
    this.history = undo(this.history);
    this.dropMissing();
  }

  redo(): void {
    this.editKey = null;
    this.history = redo(this.history);
    this.dropMissing();
  }

  /** Depois de desfazer, a seleção não aponta para o que sumiu. */
  private dropMissing(): void {
    const exists = (id: NodeId) => this.graph.nodes.some((node) => node.id === id);
    this.select(this.selectedNodeIds.filter(exists));
    if (this.armedEdgeId !== null && !this.graph.edges.some((e) => e.id === this.armedEdgeId)) {
      this.armedEdgeId = null;
    }
  }
}
