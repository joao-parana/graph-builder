// NFR-06: todos os textos da UI ficam aqui. Identificadores em inglês, textos em pt-BR.
import type { DomainErrorCode, NodeKind } from '@graph-builder/core';

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
    placeholder: 'O inspetor chega na próxima etapa (L05). Selecione e edite as peças no canvas.',
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
