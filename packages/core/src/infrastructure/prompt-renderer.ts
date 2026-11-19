// PromptRenderer: template do SPEC §6. Determinístico; não valida (ExportPrompt já validou).
import type { PromptRenderer } from '../application/index.ts';
import {
  EdgeKind,
  type Graph,
  type GraphEdge,
  type GraphNode,
  judgedSources,
  type MemoryNode,
  NODE_KIND_LABEL,
  type NodeId,
  NodeKind,
  type OnExhausted,
  SCHEMA_VERSION,
  supervisorBuilders,
  type SupervisorNode,
  topologicalOrder,
} from '../domain/index.ts';

const HOW_TO_RUN = 'Execute as etapas na ordem abaixo. Cada Trabalhador produz um artefato.';
const HOW_TO_RUN_SUPERVISOR = [
  'Cada Supervisor é um **crítico cego**: passe a ele **apenas o artefato**, nunca o raciocínio',
  'de quem o construiu. Se reprovar, devolva o artefato e o parecer ao(s) construtor(es) e repita,',
  'até as rodadas máx. do Supervisor; esgotadas, siga o "Se esgotar" dele.',
].join('\n');

const NO_INSTRUCTIONS = '_(sem instruções)_';
const NO_OBJECTIVE = '_(sem objetivo)_';
const NO_CONDITION = '_(sem condição)_';
const NO_STEPS = '_(nenhuma etapa)_';
const NO_FINAL_DELIVERY = '_(nenhuma Entrega final)_';

const ON_EXHAUSTED_TEXT: Readonly<Record<OnExhausted, string>> = {
  'deliver-best-with-caveats': 'entregar o melhor com ressalvas',
  fail: 'parar e informar a falha',
};

const HEADING_SUFFIX: Partial<Readonly<Record<NodeKind, string>>> = {
  [NodeKind.Supervisor]: ' — crítico cego',
  [NodeKind.Decision]: ' — escolha UM caminho',
};

/** Sem `\r`, sem espaços no fim das linhas e nas pontas do texto. */
const clean = (text: string): string =>
  text
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();

/** `Rótulo: texto`; texto de várias linhas vai para baixo do rótulo (§6, regra 5). */
function labeled(label: string, text: string, empty = NO_INSTRUCTIONS): string {
  const body = clean(text);
  if (body.length === 0) return `${label}: ${empty}`;
  return body.includes('\n') ? `${label}:\n${body}` : `${label}: ${body}`;
}

/** Consultas sobre o grafo com listas já na ordem topológica. */
class View {
  readonly order: readonly GraphNode[];
  private readonly rank: ReadonlyMap<NodeId, number>;
  private readonly byId: ReadonlyMap<NodeId, GraphNode>;
  private readonly edges: readonly GraphEdge[];

  constructor(readonly graph: Graph) {
    this.order = topologicalOrder(graph);
    this.rank = new Map(this.order.map((node, index) => [node.id, index]));
    this.byId = new Map(graph.nodes.map((node) => [node.id, node]));
    this.edges = graph.edges.filter((e) => this.byId.has(e.source) && this.byId.has(e.target));
  }

  private rankOf(id: NodeId): number {
    return this.rank.get(id) ?? Number.MAX_SAFE_INTEGER;
  }

  sorted(ids: Iterable<NodeId>): readonly NodeId[] {
    return [...new Set(ids)].sort((a, b) => this.rankOf(a) - this.rankOf(b));
  }

  names(ids: readonly NodeId[]): string {
    return ids.map((id) => clean(this.byId.get(id)?.name ?? '')).join(', ');
  }

  private sources(id: NodeId, kinds: readonly EdgeKind[]): readonly NodeId[] {
    return this.sorted(
      this.edges.filter((e) => e.target === id && kinds.includes(e.kind)).map((e) => e.source),
    );
  }

  private targets(id: NodeId, kinds: readonly EdgeKind[]): readonly NodeId[] {
    return this.sorted(
      this.edges.filter((e) => e.source === id && kinds.includes(e.kind)).map((e) => e.target),
    );
  }

  receivesFrom = (id: NodeId) => this.sources(id, [EdgeKind.Flow, EdgeKind.Condition]);
  sendsTo = (id: NodeId) => this.targets(id, [EdgeKind.Flow]);
  writesTo = (id: NodeId) => this.targets(id, [EdgeKind.MemoryWrite]);
  readsFrom = (id: NodeId) => this.sources(id, [EdgeKind.MemoryRead]);
  writers = (id: NodeId) => this.sources(id, [EdgeKind.MemoryWrite]);
  readers = (id: NodeId) => this.targets(id, [EdgeKind.MemoryRead]);

  /** Saídas de uma Decisão, na ordem do destino (empate pelo id do fio). */
  conditions(id: NodeId): readonly GraphEdge[] {
    return this.edges
      .filter((e) => e.source === id && e.kind === EdgeKind.Condition)
      .sort((a, b) => this.rankOf(a.target) - this.rankOf(b.target) || (a.id < b.id ? -1 : 1));
  }

  /** `Rótulo: nomes` das partes não vazias, unidas por ` · ` (§6, regra 8). */
  parts(items: readonly (readonly [string, readonly NodeId[]])[]): string[] {
    const line = items
      .filter(([, ids]) => ids.length > 0)
      .map(([label, ids]) => `${label}: ${this.names(ids)}`)
      .join(' · ');
    return line.length === 0 ? [] : [line];
  }
}

function inputSection(view: View, input: GraphNode): string {
  const links = [
    ['alimenta', view.sendsTo(input.id)],
    ['escreve em', view.writesTo(input.id)],
  ] as const;
  const suffix = links
    .filter(([, ids]) => ids.length > 0)
    .map(([label, ids]) => `${label}: ${view.names(ids)}`)
    .join(' · ');
  const body = clean(input.instructions) || NO_INSTRUCTIONS;
  return suffix.length === 0 ? body : `${body} → ${suffix}`;
}

function supervisorLines(view: View, node: SupervisorNode): string[] {
  const judged = judgedSources(view.graph, node.id).map((source) => source.id);
  const judgedSet = new Set(judged);
  const verdict = [
    ...view.parts([['Julga o que vem de', view.sorted(judged)]]),
    `Rodadas máx.: ${String(node.maxRounds)}`,
    `Se esgotar: ${ON_EXHAUSTED_TEXT[node.onExhausted]}`,
  ].join(' · ');
  const builders = view.sorted(supervisorBuilders(view.graph, node.id));
  const approved = view.sendsTo(node.id);
  return [
    labeled('A barra', node.instructions),
    verdict,
    ...view.parts([
      ['Também recebe de', view.receivesFrom(node.id).filter((id) => !judgedSet.has(id))],
    ]),
    ...view.parts([['Se reprovar, devolve para', builders]]),
    ...(approved.length === 0 ? [] : [`Aprovado → ${view.names(approved)}`]),
    ...view.parts([
      ['Escreve em', view.writesTo(node.id)],
      ['Consulta', view.readsFrom(node.id)],
    ]),
  ];
}

function stepLines(view: View, node: GraphNode): string[] {
  const { id } = node;
  switch (node.kind) {
    case NodeKind.Supervisor:
      return supervisorLines(view, node);
    case NodeKind.Decision:
      return [
        labeled('Instruções', node.instructions),
        ...view.parts([
          ['Recebe de', view.receivesFrom(id)],
          ['Escreve em', view.writesTo(id)],
          ['Consulta', view.readsFrom(id)],
        ]),
        ...view.conditions(id).map((edge) => {
          const condition = clean(edge.condition ?? '');
          const when = condition.length === 0 ? NO_CONDITION : `"${condition}"`;
          return `- Se ${when} → ${view.names([edge.target])}`;
        }),
      ];
    case NodeKind.Delivery: {
      const inputs = view.receivesFrom(id);
      return [
        labeled('Instruções', node.instructions),
        ...(inputs.length === 0 ? [] : [`Junte: ${view.names(inputs)} → artefato final.`]),
        ...view.parts([
          ['Envia para', view.sendsTo(id)],
          ['Escreve em', view.writesTo(id)],
          ['Consulta', view.readsFrom(id)],
        ]),
      ];
    }
    default:
      return [
        labeled('Instruções', node.instructions),
        ...view.parts([
          ['Recebe de', view.receivesFrom(id)],
          ['Envia para', view.sendsTo(id)],
          ['Escreve em', view.writesTo(id)],
          ['Consulta', view.readsFrom(id)],
        ]),
      ];
  }
}

function stepsSection(view: View): string {
  const steps = view.order.filter(
    (node) => node.kind !== NodeKind.Input && node.kind !== NodeKind.Memory,
  );
  if (steps.length === 0) return `## Etapas\n${NO_STEPS}`;
  const blocks = steps.map((node, index) => {
    const title = `${NODE_KIND_LABEL[node.kind]}${HEADING_SUFFIX[node.kind] ?? ''}`;
    const heading = `### ${String(index + 1)}. ${clean(node.name)} (${title})`;
    return [heading, ...stepLines(view, node)].join('\n');
  });
  return `## Etapas\n${blocks.join('\n\n')}`;
}

function memoryItem(view: View, memory: MemoryNode): string {
  const relations = memory.relations.map((relation) => `\`${relation}\``).join(', ');
  const links: readonly (readonly [string, readonly NodeId[]])[] = [
    ['Escrevem', view.writers(memory.id)],
    ['Consultam', view.readers(memory.id)],
  ];
  const sentences = [
    `relações: ${relations.length === 0 ? 'livres' : relations}.`,
    ...links
      .filter(([, ids]) => ids.length > 0)
      .map(([label, ids]) => `${label}: ${view.names(ids)}.`),
  ];
  const item = `- ${clean(memory.name)} — ${sentences.join(' ')}`;
  const notes = clean(memory.instructions);
  if (notes.length === 0) return item;
  return [item, ...notes.split('\n').map((line) => (line.length === 0 ? '' : `  ${line}`))].join(
    '\n',
  );
}

function outputSection(view: View): string {
  const finals = view.order.filter(
    (node) => node.kind === NodeKind.Delivery && view.sendsTo(node.id).length === 0,
  );
  const quoted = finals.map((node) => `"${clean(node.name)}"`).join(', ');
  const text =
    finals.length === 0
      ? NO_FINAL_DELIVERY
      : finals.length === 1
        ? `O artefato de ${quoted}.`
        : `Os artefatos de ${quoted}.`;
  return `## Saída esperada\n${text}`;
}

export function renderPrompt(graph: Graph): string {
  const view = new View(graph);
  const inputs = view.order.filter((node) => node.kind === NodeKind.Input);
  const memories = view.order.filter((node): node is MemoryNode => node.kind === NodeKind.Memory);
  const hasSupervisor = graph.nodes.some((node) => node.kind === NodeKind.Supervisor);

  const sections = [
    `# Grafo: ${clean(graph.name)}`,
    `## Objetivo\n${clean(graph.objective) || NO_OBJECTIVE}`,
    ['## Como executar', HOW_TO_RUN, ...(hasSupervisor ? [HOW_TO_RUN_SUPERVISOR] : [])].join('\n'),
    ...(inputs.length === 0
      ? []
      : [`## Entrada\n${inputs.map((input) => inputSection(view, input)).join('\n\n')}`]),
    stepsSection(view),
    ...(memories.length === 0
      ? []
      : [`## Memória\n${memories.map((m) => memoryItem(view, m)).join('\n')}`]),
    outputSection(view),
    `<!-- graph-builder schemaVersion=${String(SCHEMA_VERSION)} graphId=${graph.id} -->`,
  ];
  return `${sections.join('\n\n')}\n`;
}

export const markdownPromptRenderer: PromptRenderer = { render: renderPrompt };
