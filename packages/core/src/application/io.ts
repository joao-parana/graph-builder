// Validação, exportação e importação (SPEC §7.2, FR-20..22).
import {
  checkGraph,
  type DomainError,
  err,
  type Graph,
  graphId,
  ok,
  type Result,
  validateGraph,
  type ValidationIssue,
} from '../domain/index.ts';
import type { CodecIssue, EditContext, GraphCodec, PromptRenderer } from './ports.ts';

/** ValidateGraph: itens do painel "Antes de exportar" (FR-20). */
export const validate = (graph: Graph): readonly ValidationIssue[] => validateGraph(graph);

/** ExportPrompt (FR-21): com erro de validação devolve só os erros; senão, o prompt. */
export function exportPrompt(
  graph: Graph,
  renderer: PromptRenderer,
): Result<string, readonly ValidationIssue[]> {
  const errors = validateGraph(graph).filter((item) => item.level === 'error');
  return errors.length > 0 ? err(errors) : ok(renderer.render(graph));
}

/** ExportJson (FR-21). Não depende da validação: o JSON guarda o rascunho como está. */
export const exportJson = (graph: Graph, codec: GraphCodec): string => codec.encode(graph);

export type ImportError =
  | { readonly kind: 'codec'; readonly issues: readonly CodecIssue[] }
  | { readonly kind: 'invariants'; readonly errors: readonly DomainError[] };

/** ImportJson (FR-22): o grafo importado ganha GraphId novo e `updatedAt = now`. */
export function importJson(
  ctx: EditContext,
  text: string,
  codec: GraphCodec,
): Result<Graph, ImportError> {
  const decoded = codec.decode(text);
  if (!decoded.ok) return err({ kind: 'codec', issues: decoded.error });
  const errors = checkGraph(decoded.value);
  if (errors.length > 0) return err({ kind: 'invariants', errors });
  return ok({ ...decoded.value, id: graphId(ctx.ids.next()), updatedAt: ctx.clock.now() });
}
