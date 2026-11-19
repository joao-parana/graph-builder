// Grafo aberto + "Meus grafos" (FR-30, FR-31). Liga o Editor ao GraphRepository: salva com debounce
// e troca de grafo gravando antes o que estiver pendente. Na v2, o repositório troca com o modo
// (FR-53) e a mensagem de falha depende dele (FR-55).
import {
  copyGraph,
  createGraph,
  deleteGraph,
  type DomainError,
  duplicateGraph,
  type Graph,
  type GraphId,
  type GraphRepository,
  type GraphSummary,
  listGraphs,
  openGraph,
  renameGraph,
  saveGraph,
} from '@graph-builder/core';
import { ptBR } from '#lib/i18n/pt-BR.ts';
import type { Editor, Viewport } from './editor.svelte.ts';

/** FR-30: espera entre a última mudança e a gravação. */
export const SAVE_DEBOUNCE_MS = 500;

export type SaveStatus = 'saved' | 'saving' | 'error';

/** Texto do toast quando a gravação falha (local: o do FR-30; nuvem: FR-55). */
export type DescribeFailure = (error: unknown) => string;

const localFailure: DescribeFailure = () => ptBR.top.saveFailed;

export class Workspace {
  private readonly editor: Editor;
  private repo: GraphRepository;
  private describeFailure: DescribeFailure = localFailure;
  private readonly delay: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Última versão gravada (grafo do histórico + viewport): igual a ela, não grava de novo. */
  private stored: { graph: Graph; viewport: Viewport } | null = null;
  private writing: Promise<void> = Promise.resolve();

  status: SaveStatus = $state('saved');
  /** Lista do modal "Meus grafos"; `refresh` atualiza. */
  graphs: readonly GraphSummary[] = $state.raw([]);

  constructor(editor: Editor, repo: GraphRepository, delay = SAVE_DEBOUNCE_MS) {
    this.editor = editor;
    this.repo = repo;
    this.delay = delay;
  }

  get currentId(): GraphId {
    return this.editor.graph.id;
  }

  /** Ao iniciar: o mais recente, ou um grafo novo já salvo. */
  async start(): Promise<void> {
    const [latest] = await listGraphs(this.repo);
    const graph = latest === undefined ? null : await openGraph(this.repo, latest.id);
    if (graph === null) await this.newGraph();
    else this.show(graph);
  }

  /** Chamado a cada mudança do grafo ou do viewport. */
  schedule(): void {
    if (this.isStored()) return;
    this.status = 'saving';
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save();
    }, this.delay);
  }

  /** Grava já o que estiver pendente (antes de trocar de grafo). */
  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
      await this.save();
    }
    await this.writing;
  }

  private isStored(): boolean {
    const { graph, viewport } = this.editor;
    const stored = this.stored;
    return (
      stored !== null &&
      stored.graph === graph &&
      stored.viewport.x === viewport.x &&
      stored.viewport.y === viewport.y &&
      stored.viewport.zoom === viewport.zoom
    );
  }

  private save(): Promise<void> {
    const version = { graph: this.editor.graph, viewport: this.editor.viewport };
    const graph = this.editor.snapshot;
    this.writing = this.writing
      .then(() => saveGraph(this.repo, graph))
      .then(
        () => {
          this.stored = version;
          if (this.timer === null) this.status = 'saved';
        },
        (error: unknown) => {
          this.status = 'error';
          this.editor.notify(this.describeFailure(error));
        },
      );
    return this.writing;
  }

  private show(graph: Graph): void {
    this.stored = { graph, viewport: graph.viewport };
    this.status = 'saved';
    this.editor.load(graph);
  }

  private async replaceWith(graph: Graph): Promise<void> {
    await this.flush();
    await saveGraph(this.repo, graph);
    this.show(graph);
    await this.refresh();
  }

  /**
   * FR-53: troca o repositório (modo). Grava antes o pendente no repositório antigo, zera o
   * histórico e abre o mais recente do novo (ou cria um). Se o novo falhar, a exceção sobe.
   */
  async use(repo: GraphRepository, describeFailure: DescribeFailure = localFailure): Promise<void> {
    await this.flush();
    this.repo = repo;
    this.describeFailure = describeFailure;
    this.stored = null;
    this.graphs = [];
    await this.start();
  }

  /** FR-54: copia um grafo deste modo para o outro; grava antes o pendente. */
  async copyTo(id: GraphId, target: GraphRepository): Promise<Graph | null> {
    await this.flush();
    return copyGraph(this.editor.ctx, this.repo, target, id);
  }

  /** FR-56: guarda o grafo aberto em outro repositório (mesmo id), sem trocar de modo. */
  async keepIn(target: GraphRepository): Promise<void> {
    await saveGraph(target, this.editor.snapshot);
  }

  async refresh(): Promise<void> {
    this.graphs = await listGraphs(this.repo);
  }

  async open(id: GraphId): Promise<boolean> {
    if (id === this.currentId) return true;
    await this.flush();
    const graph = await openGraph(this.repo, id);
    if (graph === null) {
      await this.refresh();
      return false;
    }
    this.show(graph);
    return true;
  }

  newGraph(): Promise<void> {
    return this.replaceWith(createGraph(this.editor.ctx));
  }

  /** FR-22: o grafo vindo do `ImportJson` (id novo) é salvo e aberto. */
  importGraph(graph: Graph): Promise<void> {
    return this.replaceWith(graph);
  }

  async duplicate(id: GraphId): Promise<void> {
    await this.flush();
    const graph = await openGraph(this.repo, id);
    if (graph !== null) await saveGraph(this.repo, duplicateGraph(this.editor.ctx, graph));
    await this.refresh();
  }

  /** No grafo aberto, renomear é uma edição desfazível; nos outros, grava direto. */
  async rename(id: GraphId, name: string): Promise<DomainError | null> {
    if (id === this.currentId) {
      const error = this.editor.editGraph('name', { name });
      this.editor.endEdit();
      if (error === null) {
        this.schedule();
        await this.flush();
        await this.refresh();
      }
      return error;
    }
    const result = await renameGraph(this.editor.ctx, this.repo, id, name);
    await this.refresh();
    return result === null || result.ok ? null : result.error;
  }

  /** Apagar o aberto abre o mais recente que sobrar, ou um novo. */
  async remove(id: GraphId): Promise<void> {
    const current = id === this.currentId;
    if (current && this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.writing;
    await deleteGraph(this.repo, id);
    if (current) await this.start();
    await this.refresh();
  }
}
