# SPEC — Graph Builder (editor visual de grafos de agentes)

> **Status:** Draft v0.1 · **Data:** 2026-11-13 · **Dono:** João
> **Contrato:** este arquivo é a fonte da verdade. Mudança de comportamento = mudança aqui primeiro.
> **Origem:** inspirado na ferramenta mostrada em <https://www.youtube.com/watch?v=r8JueeaKJ9w>.
> A página do vídeo não pôde ser lida; esta spec foi derivada de uma captura de tela.
> Itens marcados **[INFERIDO]** não aparecem explicitamente na captura e devem ser validados (ver §12).

---

## 1. Visão

Um editor web, 100% local, onde o desenvolvedor **desenha um grafo de agentes** (quem constrói,
quem julga, onde decide, o que se lembra) e **exporta** esse grafo como:

1. um **prompt Markdown** pronto para colar no Claude (Claude Code / Claude Desktop), que descreve
   o fluxo de execução, os papéis e os critérios de aprovação; e
2. um **JSON versionado**, reimportável, que é o formato de persistência do próprio grafo.

O app **não executa** o grafo. Ele modela e gera a especificação; quem executa é o Claude.

### 1.1 Objetivos
- G1 — Modelar visualmente grafos com 6 tipos de peça e regras de ligação claras.
- G2 — Impedir/alertar grafos mal formados antes da exportação ("Antes de exportar").
- G3 — Exportar um prompt determinístico (mesmo grafo ⇒ mesmo texto) e um JSON reimportável.
- G4 — Guardar vários grafos localmente ("Meus grafos").

### 1.2 Fora de escopo (v1)
- Executar o grafo / chamar a API do Claude.
- Contas, login, nuvem, colaboração em tempo real (o botão "Sair" da captura **não** entra).
- Botão "Feedback".
- Exportar direto para formatos nativos do Claude Code (skills, subagents, workflows) → v2 (§11).

---

## 2. Glossário (linguagem ubíqua)

| Termo (UI, pt-BR) | Identificador (código) | Significado |
|---|---|---|
| Grafo | `Graph` | Conjunto de peças + fios + objetivo. |
| Objetivo | `Graph.objective` | O que o grafo precisa entregar. Obrigatório para exportar sem alerta. |
| Peça | `GraphNode` | Nó do grafo. Tem tipo, nome, instruções e posição. |
| Fio | `GraphEdge` | Ligação dirigida entre duas peças. |
| Entrada | `NodeKind.Input` | Insumo opcional que o usuário cola na hora de rodar. **No máximo uma por grafo.** |
| Trabalhador | `NodeKind.Worker` | Executa uma parte do trabalho. É quem constrói. |
| Supervisor | `NodeKind.Supervisor` | **Crítico cego**: recebe só o artefato (nunca o raciocínio) e aprova ou devolve para refazer. |
| A barra | `Supervisor.bar` | Critério que o Supervisor aplica. Deve ser julgável por um estranho só com o artefato. |
| Entrega | `NodeKind.Delivery` | Junta vários laços num artefato só; pode alimentar a fase seguinte. |
| Decisão | `NodeKind.Decision` | Escolhe **um** caminho. Cada fio de saída leva uma condição escrita. |
| Memória | `NodeKind.Memory` | Quadro compartilhado: itens ligados por relações com nome. Peças escrevem e consultam. |
| Laço | `Loop` | Par Trabalhador(es) → Supervisor com retorno ao construtor em caso de reprovação. |
| Preencher rápido | `BarPreset` | Botões que inserem/removem critérios prontos na barra (toggle). |

---

## 3. Modelo de domínio

### 3.1 Entidades e value objects

```ts
// domain/model — sem dependências de framework

type NodeId = Brand<string, 'NodeId'>;
type EdgeId = Brand<string, 'EdgeId'>;
type GraphId = Brand<string, 'GraphId'>;

enum NodeKind { Input = 'input', Worker = 'worker', Supervisor = 'supervisor',
                Delivery = 'delivery', Decision = 'decision', Memory = 'memory' }

interface Position { x: number; y: number }

interface BaseNode {
  id: NodeId;
  kind: NodeKind;
  name: string;          // ex.: "Trabalhador 4" (auto-gerado, editável, 1..80 chars)
  instructions: string;  // texto livre; para Supervisor é "a barra"
  position: Position;
}

interface SupervisorNode extends BaseNode {
  kind: NodeKind.Supervisor;
  presets: BarPresetId[];      // presets ativos (toggle)
  maxRounds: number;           // [INFERIDO] padrão 3, faixa 1..10
  onExhausted: 'deliver-best-with-caveats' | 'fail';  // [INFERIDO] padrão: entregar o melhor com ressalvas
}

interface MemoryNode extends BaseNode {
  kind: NodeKind.Memory;
  relations: string[];         // nomes de relações permitidas, ex.: ["depende_de", "contradiz"]
}

type GraphNode = BaseNode | SupervisorNode | MemoryNode;

enum EdgeKind {
  Flow = 'flow',               // artefato segue adiante
  Condition = 'condition',     // sai de uma Decisão; exige `condition`
  MemoryWrite = 'memory-write',// peça → Memória
  MemoryRead = 'memory-read',  // Memória → peça
}

interface GraphEdge {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  kind: EdgeKind;              // DERIVADO dos tipos das pontas (não escolhido pelo usuário)
  condition?: string;          // obrigatório se kind = Condition
}

interface Graph {
  id: GraphId;
  schemaVersion: 1;
  name: string;                // "Meu grafo"
  objective: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: { x: number; y: number; zoom: number };
  createdAt: string;           // ISO-8601
  updatedAt: string;
}
```

### 3.2 Derivação do tipo de fio

| Origem \ Destino | Memória | Qualquer outra |
|---|---|---|
| **Memória** | ✗ proibido | `MemoryRead` |
| **Decisão** | `MemoryWrite` | `Condition` |
| **Outras** | `MemoryWrite` | `Flow` |

### 3.3 Laço do Supervisor (retorno implícito)
O fio de retorno "devolve para refazer" **não é desenhado pelo usuário**: é derivado.
O Supervisor devolve para **todas as peças que produziram o que ele recebe** (origens dos seus fios
de entrada do tipo `Flow`). Na UI é mostrado como fio tracejado vermelho, não selecionável.
[INFERIDO] O ponto dourado no topo das peças na captura é tratado como âncora visual desse retorno.

### 3.4 Invariantes (violação ⇒ comando rejeitado pelo domínio)

| ID | Regra |
|---|---|
| INV-01 | No máximo **uma** Entrada por grafo. |
| INV-02 | Entrada não recebe fios. |
| INV-03 | Sem auto-ligação (`source ≠ target`). |
| INV-04 | Sem fio duplicado (mesmo par `source→target`). |
| INV-05 | Memória → Memória é proibido. |
| INV-06 | Fios `Flow`/`Condition` não podem formar ciclo (laços só existem via retorno implícito do Supervisor; fios de Memória são ignorados na checagem). |
| INV-07 | `name` não vazio, ≤ 80 chars; nomes únicos por grafo (case-insensitive). |
| INV-08 | `maxRounds` inteiro em 1..10. |

### 3.5 Regras de validação pré-exportação ("Antes de exportar")

Não bloqueiam a edição. **Erros** bloqueiam a exportação; **alertas** não.

| ID | Nível | Mensagem (pt-BR) |
|---|---|---|
| VAL-01 | erro | O grafo está sem objetivo — escreva, na direita, o que ele precisa entregar. |
| VAL-02 | alerta | "{nome}" está sem instruções. |
| VAL-03 | erro | "{Decisão}" tem um fio sem condição escrita. |
| VAL-04 | alerta | "{Decisão}" tem menos de dois caminhos. |
| VAL-05 | erro | "{Supervisor}" não recebe nada para julgar. |
| VAL-06 | alerta | "{Supervisor}" não leva a lugar nenhum (sem saída). |
| VAL-07 | erro | O grafo não tem nenhuma Entrega. |
| VAL-08 | alerta | "{nome}" está solta (sem fios). |
| VAL-09 | alerta | "{Memória}" ninguém escreve nela / ninguém consulta. |
| VAL-10 | erro | Há peças inalcançáveis a partir do início (Entrada ou peças sem entrada). |

A lista é exibida agrupada; se passar de 5 itens mostra os 5 primeiros + "+ N outros" (como na captura).

---

## 4. Requisitos funcionais

Formato: **FR-xx** · descrição · critérios de aceite (Dado/Quando/Então).

### Canvas e peças
- **FR-01 Adicionar peça** pela paleta (clique adiciona no centro visível; arrastar solta na posição).
  - Dado um grafo com uma Entrada, quando clico em "Entrada", então a peça não é criada e aparece toast "Só uma Entrada por grafo".
  - Nome automático `"{Tipo} {n}"` com `n` = menor inteiro livre.
- **FR-02 Ligar peças** arrastando do ponto direito de uma peça até o ponto esquerdo de outra.
  - Ligação inválida (INV-02..06) mostra o alvo em vermelho durante o arraste e não cria o fio.
- **FR-03 Cortar fio** com clique no fio (confirmação visual: fio fica destacado; segundo clique ou `Del` remove). [INFERIDO]
- **FR-04 Apagar peça** com `Del`/`Backspace` ou botão "Apagar" no inspetor; remove fios ligados. Desfazível.
- **FR-05 Duplicar peça** com `Ctrl/⌘+D`: copia tipo, instruções e configs; deslocamento +32px; nome com próximo `n`. Não copia fios.
- **FR-06 Mover peça** por arraste; snap opcional na grade de 16px.
- **FR-07 Controles de visão** (rodapé do canvas): zoom −/+ com % (25–200%), **Enquadrar** (fit view), **Arrumar** (auto-layout esquerda→direita), **Foco** (oculta paleta e inspetor).
- **FR-08 Desfazer/Refazer** `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z`, histórico ≥ 100 passos, por grafo, em memória.

### Inspetor (painel direito)
- **FR-10 Sem seleção** → inspetor do Grafo: nome do grafo, **Objetivo** (textarea), resumo (contagem por tipo).
- **FR-11 Peça selecionada** → selo do tipo, Nome, Instruções, texto de ajuda do tipo, "Recebe de:" / "Envia para:" (listas clicáveis), botão Apagar.
- **FR-12 Supervisor**: o campo Instruções vira **"Instruções (a barra)"**, com placeholder de exemplo; bloco **"Preencher rápido — a barra"** com presets em toggle (clicar insere o texto do preset na barra; clicar de novo remove exatamente esse trecho); campos `maxRounds` e `onExhausted`.
  - Presets v1: **Resultado WOW** ("todo crítico aprova com reação 'uau'"), **Sem erros** ("roda limpo, borda e erro forçados"), **Evidência concreta**, **Público explícito**. [os dois últimos são INFERIDOS]
- **FR-13 Decisão**: lista os fios de saída, cada um com campo **Condição** editável e o destino.
- **FR-14 Memória**: campo de relações (chips) + listas "Quem escreve" / "Quem consulta".
- **FR-15 Entrada**: instruções = descrição do insumo esperado (ex.: "cole aqui o briefing").

### Validação e exportação
- **FR-20 Painel "Antes de exportar"** flutuante no canto inferior direito do canvas, recalculado a cada mudança (debounce 150 ms); clicar num item seleciona e centraliza a peça. Some quando não há itens.
- **FR-21 Exportar para a IA** abre modal com abas **Prompt** e **JSON**:
  - Se houver erros (§3.5), a aba Prompt mostra a lista e os botões ficam desabilitados.
  - Ações: **Copiar**, **Baixar `.md`** / **Baixar `.json`**.
  - Prompt gerado segue o template do §6 e é **determinístico** (ordem topológica estável; empate por posição `x`, depois `y`, depois `id`).
- **FR-22 Abrir JSON**: importa arquivo `.json` (ou colar texto). Valida com o schema; erros exibidos com caminho do campo. Migra `schemaVersion` antigas quando houver.

### Persistência
- **FR-30 Salvamento automático** no IndexedDB a cada mudança (debounce 500 ms). Indicador "Salvo" no topo.
- **FR-31 Meus grafos**: modal com lista (nome, nº de peças, atualizado em), ações Abrir, Renomear, Duplicar, Apagar (com confirmação), **Novo grafo**.
- **FR-32 Limpar**: esvazia o grafo atual após confirmação ("Isso apaga todas as peças deste grafo"). Desfazível.
- **FR-33 Título do grafo** no centro do topo, editável inline.

### Ajuda
- **FR-40 "?"** abre painel com: descrição das peças, "Como ligar" e atalhos (o mesmo conteúdo da coluna esquerda da captura).

---

## 5. Requisitos não funcionais

| ID | Requisito |
|---|---|
| NFR-01 | TypeScript `strict: true`, `noUncheckedIndexedAccess`, proibido `any` (lint). |
| NFR-02 | Camadas `domain` e `application` sem import de React, DOM ou libs de UI (verificado por regra de lint de fronteira). |
| NFR-03 | Cobertura ≥ 90% em `domain` + `application` (Vitest). |
| NFR-04 | 200 peças / 400 fios com pan/zoom a 60 fps num M3; validação < 16 ms. |
| NFR-05 | Funciona offline; nenhum dado sai do navegador. |
| NFR-06 | UI em pt-BR; textos centralizados em `ui/src/i18n/pt-BR.ts`. |
| NFR-07 | Acessibilidade: todas as ações da paleta/inspetor por teclado; foco visível; contraste AA. |
| NFR-08 | Navegadores: Chrome, Safari e Firefox atuais. |

---

## 6. Template do prompt exportado

Gerado por `PromptRenderer` (infra). Exemplo para um grafo pequeno:

````markdown
# Grafo: Landing page do produto X

## Objetivo
Entregar a headline e o primeiro parágrafo da landing page do produto X.

## Como executar
Execute as etapas na ordem abaixo. Cada Trabalhador produz um artefato.
Cada Supervisor é um **crítico cego**: passe a ele **apenas o artefato**, nunca o raciocínio
de quem o construiu. Se reprovar, devolva o artefato e o parecer ao(s) construtor(es) e repita,
até {maxRounds} rodadas; esgotadas, siga com o melhor resultado e anote as ressalvas.

## Entrada
Cole aqui o briefing do produto. → alimenta: Trabalhador 1

## Etapas
### 1. Trabalhador 1 (Trabalhador)
Instruções: Escreva 5 headlines…
Recebe de: Entrada · Envia para: Supervisor 1 · Escreve em: Memória 1 (relação `ideia`)

### 2. Supervisor 1 (Supervisor — crítico cego)
A barra: Reprove se a headline não citar o público…
Julga o que vem de: Trabalhador 1 · Rodadas máx.: 3 · Se esgotar: entregar o melhor com ressalvas
Aprovado → Decisão 1

### 3. Decisão 1 (Decisão — escolha UM caminho)
- Se "há mais de uma headline aprovada" → Trabalhador 2
- Se "só uma aprovada" → Entrega 1

### 4. Entrega 1 (Entrega)
Junte: Supervisor 1, Trabalhador 2 → artefato final.

## Memória
- Memória 1 — relações: `ideia`, `descartada_por`. Escrevem: Trabalhador 1. Consultam: Trabalhador 2.

## Saída esperada
O artefato de "Entrega 1".

<!-- graph-builder schemaVersion=1 graphId=… -->
````

Regras do renderer: Markdown puro; sem dados de posição; peças numeradas na ordem topológica;
instruções vazias renderizadas como `_(sem instruções)_`.

---

## 7. Arquitetura

Clean Architecture em monorepo Bun (ADR-0002), com o frontend isolado em `ui/` na raiz.
Bun instala pacotes e executa scripts; Vite, Vitest e Playwright rodam no Node LTS.
Código de `packages/core` e `ui/` não usa APIs `Bun.*` nem `bun:*` (roda no navegador).

```
graph-builder/
├── SPEC.md  CLAUDE.md  HANDOFF.md
├── docs/
│   ├── adr/0001-stack-e-arquitetura.md
│   ├── adr/0002-bun-como-gerenciador-de-pacotes.md
│   └── mockups/mockups.html
├── packages/
│   └── core/                    # framework-free
│       └── src/
│           ├── domain/          # model, invariants, edge-kind derivation, validation, topo sort
│           ├── application/     # use cases + ports
│           └── infrastructure/  # zod schema, JSON codec, PromptRenderer, IndexedDB repo, layout
└── ui/                          # Vite + React + @xyflow/react (presentation)
    └── src/
        ├── canvas/  inspector/  palette/  modals/  i18n/
        └── state/               # store (Zustand) chamando use cases do core
```

### 7.1 Portas (application)
```ts
interface GraphRepository { list(): Promise<GraphSummary[]>; get(id: GraphId): Promise<Graph | null>;
                            save(g: Graph): Promise<void>; delete(id: GraphId): Promise<void> }
interface LayoutEngine   { layout(g: Graph): Map<NodeId, Position> }
interface Clock          { now(): string }
interface IdGenerator    { next(): string }
```

### 7.2 Casos de uso
`CreateGraph`, `AddNode`, `ConnectNodes`, `DisconnectEdge`, `UpdateNode`, `MoveNode`,
`DuplicateNode`, `DeleteNode`, `ToggleBarPreset`, `SetEdgeCondition`, `ValidateGraph`,
`ExportPrompt`, `ExportJson`, `ImportJson`, `AutoLayout`, `ListGraphs`, `SaveGraph`, `DeleteGraph`, `ClearGraph`.
Todos puros sobre `Graph` imutável (retornam `Result<Graph, DomainError>`), o que torna undo/redo trivial (pilha de snapshots).

### 7.3 Dependências previstas
`@xyflow/react`, `react`, `zustand`, `zod`, `idb-keyval`, `@dagrejs/dagre` (layout), `vitest`,
`@playwright/test`, `eslint` + `eslint-plugin-boundaries`, `prettier`.
(Instalação só após OK — ver CLAUDE.md.)

---

## 8. Telas (mockups)

Ver `docs/mockups/mockups.html` (abrir no navegador). Telas:

| # | Tela | FRs |
|---|---|---|
| M1 | Editor — visão geral (paleta, canvas, inspetor do Grafo, painel "Antes de exportar") | FR-01..07, FR-10, FR-20 |
| M2 | Inspetor — Trabalhador | FR-11 |
| M3 | Inspetor — Supervisor (a barra + preencher rápido + rodadas) | FR-12 |
| M4 | Inspetor — Decisão (condições por fio) | FR-13 |
| M5 | Inspetor — Memória | FR-14 |
| M6 | Modal "Exportar para a IA" (abas Prompt/JSON) | FR-21 |
| M7 | Modal "Meus grafos" | FR-31 |
| M8 | Modal "Abrir JSON" com erro de validação | FR-22 |

Paleta de cores por tipo (borda/selo): Entrada `#B08A2E` · Trabalhador `#1F3A5F` · Supervisor `#8B2323` ·
Entrega `#2F5D3A` · Decisão `#5B3A7A` · Memória `#3E4C59`. Fundo papel `#F3EEE4`, grade pontilhada.

---

## 9. Roadmap por camadas (Git flow SDD)

| Camada | Branch | Entregáveis | Gate de saída | Tag |
|---|---|---|---|---|
| 00 | `feature/layer-00-scaffold` | monorepo Bun (workspaces, `bunfig.toml`, `bun.lock`), tsconfig strict, ESLint boundaries, Vitest, Vite vazio | `bun run --filter '*' typecheck && bun run --filter '*' lint` | `v0.0.1` |
| 01 | `feature/layer-01-domain` | model, INV-01..08, derivação de fio, topo sort, VAL-01..10 | testes de domínio ≥ 90% | `v0.1.0` |
| 02 | `feature/layer-02-application` | casos de uso + portas + undo/redo | testes de casos de uso | `v0.2.0` |
| 03 | `feature/layer-03-infrastructure` | zod schema, JSON codec, PromptRenderer (golden tests), IndexedDB repo, dagre | golden files do §6 batem | `v0.3.0` |
| 04 | `feature/layer-04-ui-canvas` | canvas, paleta, peças, fios, controles de visão | Playwright: criar/ligar/cortar/duplicar | `v0.4.0` |
| 05 | `feature/layer-05-ui-panels` | inspetores M2–M5, painel "Antes de exportar" | Playwright: validação ao vivo | `v0.5.0` |
| 06 | `feature/layer-06-ui-io` | modais M6–M8, Meus grafos, autosave | Playwright: export→import ida e volta | `v1.0.0` |

Merge em `develop` ao fim de cada camada; `main` só em `v1.0.0`.

### 9.1 Gates (rodar em terminal ZSH separado, saída em `/tmp/gates.txt`)
```zsh
{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; } 2>&1 | tee /tmp/gates.txt
```

---

## 10. Estratégia de testes
- **Domínio:** tabela de casos para cada INV e VAL; testes de propriedade (fast-check) para "nenhum comando aceito produz grafo que viola invariante".
- **Renderer:** golden files em `packages/core/test/golden/*.md`; determinismo testado renderizando 2× com nós embaralhados.
- **Codec:** round-trip `Graph → JSON → Graph` idêntico; JSONs inválidos de exemplo com mensagens esperadas.
- **E2E (Playwright):** fluxos M1–M8.

---

## 11. Evoluções (v2+, não implementar agora)
- Exportar como **skill** / **subagents** / workflow do Claude Code (um arquivo por peça).
- Rodar o grafo via API (Claude Agent SDK) com visualização do progresso por peça.
- Biblioteca de grafos-modelo (pipeline com crítico, diamante fan-out/fan-in).
- Sub-grafo: Entrega de um grafo alimentando outro ("fase seguinte").

---

## 12. Questões abertas (decidir antes da camada indicada)

| # | Questão | Proposta padrão | Até |
|---|---|---|---|
| Q1 | O ponto dourado no topo das peças é o retorno do Supervisor ou outra porta? | Retorno implícito, só visual (§3.3) | L01 |
| Q2 | `maxRounds` / `onExhausted` existem no original? | Sim, padrão 3 / entregar com ressalvas | L01 |
| Q3 | Supervisor pode julgar uma Entrega (não só Trabalhador)? | Sim — qualquer `Flow` de entrada | L01 |
| Q4 | Gerenciador de pacotes: pnpm ou bun? | **Resolvida:** Bun ≥ 1.3, só para pacotes e scripts (ADR-0002) | L00 |
| Q5 | Cortar fio com 1 clique (como diz a ajuda original) ou 2? | 2 cliques (evita acidente) + undo | L04 |
| Q6 | Presets extras além de "Resultado WOW" e "Sem erros" | 4 presets do FR-12 | L05 |
