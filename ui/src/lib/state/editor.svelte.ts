// Estado do editor (ADR-0003, item 4): runes em volta dos casos de uso do core. A UI nunca muta o
// Graph: cada ação chama um caso de uso e grava o resultado no histórico (FR-08).
import {
  addNode,
  autoLayout,
  canRedo,
  canUndo,
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

export class Editor {
  private readonly ctx: EditContext;
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
  private commit(result: EditResult): boolean {
    if (!result.ok) return this.refuse(result.error);
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

  /** FR-08. */
  undo(): void {
    this.history = undo(this.history);
    this.dropMissing();
  }

  redo(): void {
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
