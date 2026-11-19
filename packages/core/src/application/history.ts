// Desfazer/Refazer (FR-08): pilha de snapshots imutáveis, por grafo, em memória.
import type { Graph } from '../domain/index.ts';

export const HISTORY_LIMIT = 100;

export interface History {
  readonly past: readonly Graph[];
  readonly present: Graph;
  readonly future: readonly Graph[];
}

export const startHistory = (graph: Graph): History => ({ past: [], present: graph, future: [] });

/** Registra o resultado de um comando. O mesmo objeto (comando sem mudança) não entra. */
export function record(history: History, next: Graph): History {
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export const canUndo = (history: History): boolean => history.past.length > 0;
export const canRedo = (history: History): boolean => history.future.length > 0;

export function undo(history: History): History {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}

/**
 * Troca o grafo atual sem criar passo (FR-08, L05): junta as edições de um campo num passo só.
 * O mesmo objeto não muda nada; um grafo novo descarta o refazer.
 */
export function amend(history: History, next: Graph): History {
  if (next === history.present) return history;
  return { past: history.past, present: next, future: [] };
}
