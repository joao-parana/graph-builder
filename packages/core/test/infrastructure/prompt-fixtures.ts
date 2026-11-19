// Grafos dos golden files do renderer (SPEC §6).
import { type Graph, type GraphNode, NodeKind } from '../../src/domain/index.ts';
import { graph, type Link, node, type NodeSpec } from '../domain/fixtures.ts';

const named = (kind: NodeKind, id: string, spec: NodeSpec & { name: string }): GraphNode =>
  node(kind, id, { instructions: '', ...spec });

/** O exemplo do SPEC §6. */
export function landingPagePrompt(): Graph {
  const nodes: GraphNode[] = [
    named(NodeKind.Input, 'in', {
      name: 'Entrada',
      instructions: 'Cole aqui o briefing do produto.',
      x: 0,
    }),
    named(NodeKind.Worker, 'w1', {
      name: 'Trabalhador 1',
      instructions: 'Escreva 5 headlines para o público do briefing.',
      x: 100,
    }),
    named(NodeKind.Supervisor, 's1', {
      name: 'Supervisor 1',
      instructions: 'Reprove se a headline não citar o público.',
      x: 200,
    }),
    named(NodeKind.Decision, 'd1', {
      name: 'Decisão 1',
      instructions: 'Olhe as headlines aprovadas e escolha um caminho.',
      x: 300,
    }),
    named(NodeKind.Worker, 'w2', {
      name: 'Trabalhador 2',
      instructions: 'Escreva o primeiro parágrafo para cada headline aprovada.',
      x: 400,
    }),
    named(NodeKind.Delivery, 'e1', {
      name: 'Entrega 1',
      instructions: 'Monte a headline e o parágrafo finais.',
      x: 500,
      y: 100,
    }),
    {
      ...named(NodeKind.Memory, 'm1', {
        name: 'Memória 1',
        instructions: 'Guarde cada headline proposta e, quando descartada, o motivo.',
        x: 100,
        y: 300,
      }),
      kind: NodeKind.Memory,
      relations: ['ideia', 'descartada_por'],
    },
  ];
  const links: Link[] = [
    ['in', 'w1'],
    ['w1', 's1'],
    ['s1', 'd1'],
    ['d1', 'w2', { condition: 'há mais de uma headline aprovada' }],
    ['d1', 'e1', { condition: 'só uma aprovada' }],
    ['w2', 'e1'],
    ['w1', 'm1'],
    ['m1', 'w2'],
  ];
  return {
    ...graph(nodes, links),
    name: 'Landing page do produto X',
    objective: 'Entregar a headline e o primeiro parágrafo da landing page do produto X.',
  };
}

/** Sem Entrada, Supervisor nem Memória; textos vazios e com espaços nas pontas. */
export function minimalPrompt(): Graph {
  const nodes = [
    named(NodeKind.Worker, 'w', { name: '  Pesquisa  ', x: 0 }),
    named(NodeKind.Delivery, 'e', {
      name: 'Resumo',
      instructions: 'Resuma em 3 tópicos.  ',
      x: 100,
    }),
  ];
  return { ...graph(nodes, [['w', 'e']], '   '), name: ' Mínimo ' };
}

/**
 * Críticos em série, Supervisor que julga Entrega, Entrada que não é julgada, várias Entregas
 * finais, barra de várias linhas, condição vazia e Memória sem relações.
 */
export function reviewLoopPrompt(): Graph {
  const nodes: GraphNode[] = [
    named(NodeKind.Input, 'in', { name: 'Entrada', x: 0 }),
    named(NodeKind.Worker, 'w1', {
      name: 'Redator',
      instructions: 'Escreva o rascunho.  \r\nUse o tom do briefing.\n',
      x: 100,
    }),
    {
      ...(named(NodeKind.Supervisor, 's1', {
        name: 'Revisor de estilo',
        instructions:
          'Todo crítico aprova com reação "uau".\nO público-alvo está explícito no artefato.',
        x: 200,
      }) as GraphNode & { kind: NodeKind.Supervisor }),
      presets: ['wow', 'explicit-audience'],
    },
    {
      ...(named(NodeKind.Supervisor, 's2', {
        name: 'Revisor técnico',
        instructions: 'Reprove qualquer dado sem fonte.',
        x: 300,
        maxRounds: 5,
      }) as GraphNode & { kind: NodeKind.Supervisor }),
      onExhausted: 'fail',
    },
    named(NodeKind.Delivery, 'e1', { name: 'Rascunho final', x: 400 }),
    named(NodeKind.Supervisor, 's3', {
      name: 'Auditor',
      instructions: 'Confira a ortografia.',
      x: 500,
    }),
    named(NodeKind.Decision, 'd1', {
      name: 'Triagem',
      instructions: 'Veja o idioma do público.',
      x: 600,
    }),
    named(NodeKind.Delivery, 'e2', { name: 'Publicação', instructions: 'Publique.', x: 700, y: 0 }),
    named(NodeKind.Delivery, 'e3', { name: 'Tradução', instructions: 'Traduza.', x: 700, y: 100 }),
    {
      ...named(NodeKind.Memory, 'm1', { name: 'Glossário', x: 100, y: 300 }),
      kind: NodeKind.Memory,
      relations: [],
    },
  ];
  const links: Link[] = [
    ['in', 'w1'],
    ['in', 's1'],
    ['w1', 's1'],
    ['s1', 's2'],
    ['s2', 'e1'],
    ['e1', 's3'],
    ['s3', 'd1'],
    ['d1', 'e3', { condition: 'precisa de tradução' }],
    ['d1', 'e2', { condition: '' }],
    ['w1', 'm1'],
    ['d1', 'm1'],
    ['m1', 's2'],
    ['m1', 'e3'],
  ];
  return {
    ...graph(nodes, links, 'Publicar o artigo revisado.'),
    name: 'Revisão em série',
  };
}
