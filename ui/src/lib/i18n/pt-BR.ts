// NFR-06: todos os textos da UI ficam aqui. Identificadores em inglês, textos em pt-BR.
import type {
  BarPresetId,
  DomainErrorCode,
  NameProblem,
  NodeKind,
  OnExhausted,
  ValidationRule,
} from '@graph-builder/core';

export const ptBR = {
  app: {
    title: 'Graph Builder',
    tagline: 'Editor visual de grafos de agentes',
    brandNote: 'grafos de agentes',
  },
  palette: {
    pieces: 'Peças',
    structure: 'Estrutura',
    shortcuts: 'Atalhos',
    shortcutsHelp: 'Del apaga · ⌘D duplica · ⌘Z desfaz · clique no fio para cortar',
    /** Descrição de cada tipo na paleta (M1). */
    description: {
      input: 'Opcional: o insumo que você cola na hora de rodar. Uma por grafo.',
      worker: 'Executa uma parte do trabalho. É quem constrói.',
      supervisor: 'Crítico cego: julga o que chegou e devolve para refazer.',
      delivery: 'Junta vários laços num artefato só.',
      decision: 'Escolhe UM caminho. Cada fio leva uma condição.',
      memory: 'Quadro compartilhado com relações nomeadas.',
    } satisfies Record<`${NodeKind}`, string>,
    addHint: 'Clique para pôr no centro ou arraste para o canvas',
  },
  node: {
    noInstructions: 'Sem instruções ainda — clique para escrever.',
    relationsEmpty: 'Relações livres',
  },
  canvas: {
    label: 'Canvas do grafo',
    zoomOut: 'Diminuir zoom',
    zoomIn: 'Aumentar zoom',
    fit: 'Enquadrar',
    arrange: 'Arrumar',
    grid: 'Grade',
    focus: 'Foco',
  },
  inspector: {
    graphBadge: 'Grafo',
    graphName: 'Nome do grafo',
    objective: 'Objetivo',
    objectiveHelp: 'O objetivo abre o prompt exportado. Sem ele, a exportação fica bloqueada.',
    summary: 'Resumo',
    /** Contagem por tipo no resumo (FR-10): singular e plural. */
    count: {
      input: ['Entrada', 'Entradas'],
      worker: ['Trabalhador', 'Trabalhadores'],
      supervisor: ['Supervisor', 'Supervisores'],
      delivery: ['Entrega', 'Entregas'],
      decision: ['Decisão', 'Decisões'],
      memory: ['Memória', 'Memórias'],
    } satisfies Record<`${NodeKind}`, readonly [string, string]>,
    wires: (n: number) => (n === 1 ? '1 fio' : `${String(n)} fios`),
    loops: (n: number) => (n === 1 ? '1 laço de retorno' : `${String(n)} laços de retorno`),
    manySelected: (n: number) => `${String(n)} peças selecionadas`,
    delete: 'Apagar',
    nodeName: 'Nome da peça',
    instructions: 'Instruções',
    bar: 'Instruções (a barra)',
    barPlaceholder: 'Ex.: Reprove se a headline não citar o público ou se faltar prova concreta.',
    inputPlaceholder: 'Ex.: Cole aqui o briefing do produto.',
    /** Texto de ajuda de cada tipo (FR-11). */
    help: {
      input: 'O insumo que você cola na hora de rodar. Descreva o que deve vir aqui.',
      worker: 'Quem constrói. Recebe o insumo e produz um artefato.',
      supervisor: 'Crítico cego: recebe só o artefato, nunca o raciocínio de quem construiu.',
      delivery: 'Junta o que chega num artefato só, que pode alimentar a fase seguinte.',
      decision: 'Escolhe UM caminho. Cada fio de saída leva uma condição escrita.',
      memory:
        'Fio de uma peça para a Memória = ela escreve. Fio da Memória para uma peça = ela consulta.',
    } satisfies Record<`${NodeKind}`, string>,
    receivesFrom: 'Recebe de',
    sendsTo: 'Envia para',
    writesTo: 'Escreve em',
    readsFrom: 'Consulta',
    judges: 'Julga o que vem de',
    approved: 'Aprovado →',
    writers: 'Quem escreve',
    readers: 'Quem consulta',
    nobody: 'ninguém ainda',
    quickFill: 'Preencher rápido — a barra',
    maxRounds: 'Rodadas máx.',
    onExhausted: 'Se esgotar',
    onExhaustedOption: {
      'deliver-best-with-caveats': 'Entregar o melhor com ressalvas',
      fail: 'Parar e informar a falha',
    } satisfies Record<OnExhausted, string>,
    paths: 'Caminhos (escolhe UM)',
    conditionPlaceholder: 'Escreva a condição deste caminho',
    conditionMissing: 'Este fio precisa de uma condição escrita.',
    noPaths: 'Ligue a Decisão a duas ou mais peças para criar os caminhos.',
    relations: 'Relações',
    addRelation: '+ adicionar',
    removeRelation: (relation: string) => `Remover a relação ${relation}`,
    /** Motivo do INV-07/INV-09 embaixo do campo de nome. */
    nameProblem: {
      empty: 'O nome não pode ficar vazio.',
      'too-long': 'O nome passa de 80 caracteres.',
      duplicate: 'Já existe uma peça com esse nome.',
    } satisfies Record<NameProblem, string>,
    maxRoundsProblem: 'Use um número inteiro de 1 a 10.',
  },
  /** FR-12, Q6: rótulo e descrição de cada preset; o texto inserido fica no core. */
  presets: {
    wow: { label: 'Resultado WOW', description: 'todo crítico aprova com reação "uau"' },
    'no-errors': { label: 'Sem erros', description: 'roda limpo, borda e erro forçados' },
    'concrete-evidence': { label: 'Evidência concreta', description: 'toda afirmação tem prova' },
    'explicit-audience': { label: 'Público explícito', description: 'o público-alvo está nomeado' },
  } satisfies Record<BarPresetId, { label: string; description: string }>,
  /** FR-20 e §3.5. `name`: nome da peça; `missing` (VAL-09): `write` ou `read`. */
  validation: {
    title: 'Antes de exportar',
    more: (n: number) => (n === 1 ? '+ 1 outro' : `+ ${String(n)} outros`),
    rule: {
      'VAL-01': () =>
        'O grafo está sem objetivo — escreva, na direita, o que ele precisa entregar.',
      'VAL-02': (p) => `"${p.name ?? ''}" está sem instruções.`,
      'VAL-03': (p) => `"${p.name ?? ''}" tem um fio sem condição escrita.`,
      'VAL-04': (p) => `"${p.name ?? ''}" tem menos de dois caminhos.`,
      'VAL-05': (p) => `"${p.name ?? ''}" não recebe nada para julgar.`,
      'VAL-06': (p) => `"${p.name ?? ''}" não leva a lugar nenhum (sem saída).`,
      'VAL-07': () => 'O grafo não tem nenhuma Entrega.',
      'VAL-08': (p) => `"${p.name ?? ''}" está solta (sem fios).`,
      'VAL-09': (p) =>
        p.missing === 'read'
          ? `"${p.name ?? ''}" ninguém consulta.`
          : `"${p.name ?? ''}" ninguém escreve nela.`,
      'VAL-10': () => 'Há peças inalcançáveis a partir do início (Entrada ou peças sem entrada).',
    } satisfies Record<
      ValidationRule,
      (params: Readonly<Record<string, string | undefined>>) => string
    >,
  },
  /** Motivo mostrado no toast quando o domínio recusa um comando (FR-08). */
  errors: {
    'INV-01': 'Só uma Entrada por grafo',
    'INV-02': 'A Entrada não recebe fios',
    'INV-03': 'Uma peça não se liga a ela mesma',
    'INV-04': 'Esse fio já existe',
    'INV-05': 'Memória não se liga a outra Memória',
    'INV-06': 'Esse fio fecharia um ciclo',
    'INV-07': 'Nome inválido',
    'INV-08': 'Rodadas fora da faixa 1 a 10',
    'INV-09': 'Nome do grafo inválido',
    NODE_NOT_FOUND: 'A peça não existe mais',
    EDGE_NOT_FOUND: 'O fio não existe mais',
    EDGE_KIND_MISMATCH: 'Tipo de fio inválido',
    NOT_APPLICABLE: 'Ação não se aplica a esse item',
  } satisfies Record<DomainErrorCode, string>,
} as const;
