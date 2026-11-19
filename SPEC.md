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
  maxRounds: number;           // padrão 3, faixa 1..10 (Q2)
  onExhausted: 'deliver-best-with-caveats' | 'fail';  // padrão: entregar o melhor com ressalvas (Q2)
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
Na UI é mostrado como fio tracejado vermelho, não selecionável.

Regras (Q1, Q3):
1. **O que o Supervisor julga:** o que chega a ele por fio `Flow`. Contam só origens do tipo
   **Trabalhador**, **Entrega** ou **Supervisor**. Entrada não é julgada (o insumo não se refaz).
   Fios `Condition` e `MemoryRead` não contam.
2. **Construtores** (destinos do retorno) de um Supervisor `S`:
   - cada origem Trabalhador ou Entrega de um fio `Flow` que entra em `S`;
   - para cada origem Supervisor `S'` (críticos em série), os construtores de `S'`, por recursão.
     A recursão termina porque fios `Flow` não formam ciclo (INV-06).
3. **Ponto dourado:** âncora **só visual** no topo das peças Trabalhador e Entrega (as que podem ser
   construtores). O retorno desenhado sai do Supervisor e chega nesse ponto. O ponto não aceita
   ligação nem arraste. Não é porta nem dado do modelo.
4. O domínio expõe a derivação como função pura (`supervisorBuilders(graph, supervisorId)`); os
   fios de retorno nunca entram em `Graph.edges`.

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
| INV-09 | Nome do grafo não vazio, ≤ 80 chars (mesma regra de forma do INV-07). |

### 3.5 Regras de validação pré-exportação ("Antes de exportar")

Não bloqueiam a edição. **Erros** bloqueiam a exportação; **alertas** não.

| ID | Nível | Mensagem (pt-BR) |
|---|---|---|
| VAL-01 | erro | O grafo está sem objetivo — escreva, na direita, o que ele precisa entregar. |
| VAL-02 | alerta | "{nome}" está sem instruções. |
| VAL-03 | erro | "{Decisão}" tem um fio sem condição escrita. |
| VAL-04 | alerta | "{Decisão}" tem menos de dois caminhos. |
| VAL-05 | erro | "{Supervisor}" não recebe nada para julgar. (Sem fio `Flow` vindo de Trabalhador, Entrega ou Supervisor — §3.3.) |
| VAL-06 | alerta | "{Supervisor}" não leva a lugar nenhum (sem saída). |
| VAL-07 | erro | O grafo não tem nenhuma Entrega. |
| VAL-08 | alerta | "{nome}" está solta (sem fios). |
| VAL-09 | alerta | "{Memória}" ninguém escreve nela / ninguém consulta. |
| VAL-10 | erro | Há peças inalcançáveis a partir do início (Entrada ou peças sem entrada). |

**VAL-10 — início e alcance:** se o grafo tem Entrada, o início é **só a Entrada**; sem Entrada,
o início são as peças (exceto Memória) sem fio `Flow`/`Condition` de entrada. O alcance segue só
fios `Flow` e `Condition`. Ficam fora da checagem as Memórias (VAL-09 cobre) e as peças sem
nenhum fio `Flow`/`Condition` (VAL-08 cobre as soltas; assim uma peça recém-criada não bloqueia
a exportação).

**Contrato do domínio:** `validateGraph` devolve itens `{ rule, level, nodeIds, params }` sem texto;
as mensagens acima ficam em `ui/src/lib/i18n/pt-BR.ts` (NFR-06). Ordem: erros antes de alertas,
depois por ID da regra e ordem das peças no grafo.

A lista é exibida agrupada; se passar de 5 itens mostra os 5 primeiros + "+ N outros" (como na captura).

---

## 4. Requisitos funcionais

Formato: **FR-xx** · descrição · critérios de aceite (Dado/Quando/Então).

### Canvas e peças
- **FR-01 Adicionar peça** pela paleta (clique adiciona no centro visível; arrastar solta na posição).
  - Dado um grafo com uma Entrada, quando clico em "Entrada", então a peça não é criada e aparece toast "Só uma Entrada por grafo".
  - Nome automático `"{Tipo} {n}"` com `n` = menor inteiro livre.
  - O clique põe o canto da peça no centro visível, na grade de 16 px; se já houver peça nesse
    ponto, desce +32 px em x e y até achar um livre (como o FR-05). A peça nova fica selecionada.
- **FR-02 Ligar peças** arrastando do ponto direito de uma peça até o ponto esquerdo de outra.
  - Ligação inválida (INV-02..06) mostra o alvo em vermelho durante o arraste e não cria o fio.
- **FR-03 Cortar fio** em 2 passos (Q5): o 1º clique seleciona o fio (fica destacado); um 2º clique
  no mesmo fio, `Del` ou `Backspace` remove. `Esc` ou clique fora cancela. Desfazível (FR-08).
  - Clique (num fio ou no vazio do canvas) tolera até 4 px de movimento entre apertar e soltar;
    acima disso o gesto é arrastar o canvas e não conta como clique.
- **FR-04 Apagar peça** com `Del`/`Backspace` ou botão "Apagar" no inspetor; remove fios ligados. Desfazível.
- **FR-05 Duplicar peça** com `Ctrl/⌘+D`: copia tipo, instruções e configs; deslocamento +32px; nome com próximo `n`. Não copia fios.
- **FR-06 Mover peça** por arraste; snap opcional na grade de 16px.
  - O snap começa ligado; o botão **Grade** no rodapé do canvas liga e desliga. A posição vai ao
    grafo ao soltar a peça (um passo de desfazer por arraste).
- **FR-07 Controles de visão** (rodapé do canvas): zoom −/+ com % (25–200%), **Enquadrar** (fit view), **Arrumar** (auto-layout esquerda→direita), **Foco** (oculta paleta e inspetor).
  - − e + mudam o zoom em 10 pontos percentuais, presos à faixa 25–200%. **Arrumar** é desfazível.
- **FR-09 Desenho dos fios** (§3.3): fio comum em linha cheia com seta; fio de Memória
  (`MemoryWrite`/`MemoryRead`) pontilhado cinza; retorno implícito do Supervisor tracejado
  vermelho, saindo do topo do Supervisor até o ponto dourado do construtor, sem seleção nem corte.
  Fio armado para corte (FR-03) fica destacado.
- **FR-08 Desfazer/Refazer** `Ctrl/⌘+Z` / `Ctrl/⌘+Shift+Z`, histórico ≥ 100 passos, por grafo, em memória.
  - Atalhos de teclado (FR-03..05, FR-08) não agem com o foco num campo de texto.
  - Comando recusado pelo domínio (ex.: INV-01 ao adicionar ou duplicar a Entrada) mostra um
    toast com o motivo e não altera o grafo.
  - Edição de texto no inspetor (L05): cada tecla já muda o grafo, mas a sequência de edições no
    mesmo campo é **um passo** de desfazer, fechado quando o campo perde o foco
    (`amend` do histórico, §7.2).

### Inspetor (painel direito)
- **FR-10 Sem seleção** → inspetor do Grafo: nome do grafo, **Objetivo** (textarea), resumo (contagem por tipo).
  - Resumo: contagem por tipo (como no M1) e "N fios · M laços de retorno" (retornos do §3.3).
  - Várias peças selecionadas → "N peças selecionadas" e botão Apagar.
  - Campo com valor que o domínio recusa (INV-07, INV-08, INV-09): o campo guarda o texto digitado
    e mostra o motivo logo abaixo (sem toast); o grafo não muda. Ao perder o foco, volta ao último
    valor válido.
- **FR-11 Peça selecionada** → selo do tipo, Nome, Instruções, texto de ajuda do tipo, "Recebe de:" / "Envia para:" (listas clicáveis), botão Apagar.
  - Listas com os rótulos do §6 (regra 8). Trabalhador e Entrega: Recebe de, Envia para, Escreve
    em, Consulta. Supervisor: Julga o que vem de, Aprovado →. Clicar num nome seleciona e
    centraliza a peça.
- **FR-12 Supervisor**: o campo Instruções vira **"Instruções (a barra)"**, com placeholder de exemplo; bloco **"Preencher rápido — a barra"** com presets em toggle (clicar insere o texto do preset na barra; clicar de novo remove exatamente esse trecho); campos `maxRounds` e `onExhausted`.
  - Presets v1 (Q6). O texto inserido vai para a barra e para o prompt exportado:

    | `BarPresetId` | Rótulo | Descrição (no botão) | Texto inserido na barra |
    |---|---|---|---|
    | `wow` | Resultado WOW | todo crítico aprova com reação "uau" | `Todo crítico aprova com reação "uau".` |
    | `no-errors` | Sem erros | roda limpo, borda e erro forçados | `Roda limpo, inclusive com casos de borda e erros forçados.` |
    | `concrete-evidence` | Evidência concreta | toda afirmação tem prova | `Toda afirmação tem prova concreta.` |
    | `explicit-audience` | Público explícito | o público-alvo está nomeado | `O público-alvo está explícito no artefato.` |

  - **Ligar:** o texto entra numa linha nova no fim da barra (sem linha em branco extra).
    **Desligar:** remove a linha com exatamente esse texto; se o usuário editou a linha, ela fica e
    só o preset é desligado. O catálogo e os textos inseridos ficam no core (são dados do prompt);
    rótulos e descrições ficam no i18n da UI (NFR-06).
- **FR-13 Decisão**: lista os fios de saída, cada um com campo **Condição** editável e o destino.
  - Condição vazia: campo em vermelho e o aviso "Este fio precisa de uma condição escrita." (M4).
- **FR-14 Memória**: campo de relações (chips) + listas "Quem escreve" / "Quem consulta".
  - Chip com × remove; "+ adicionar" aceita Enter ou vírgula. Lista vazia → "ninguém ainda" em
    vermelho.
- **FR-15 Entrada**: instruções = descrição do insumo esperado (ex.: "cole aqui o briefing").

### Validação e exportação
- **FR-20 Painel "Antes de exportar"** flutuante no canto inferior direito do canvas, recalculado a cada mudança (debounce 150 ms); clicar num item seleciona e centraliza a peça. Some quando não há itens.
  - Clique seleciona a 1ª peça do item. Itens sem peça (VAL-01, VAL-07) tiram a seleção; o VAL-01
    põe o foco no campo Objetivo.
  - Peças citadas num alerta ou erro ganham o contorno amarelo do M1.
- **FR-21 Exportar para a IA** abre modal com abas **Prompt** e **JSON**:
  - Se houver erros (§3.5), a aba Prompt mostra a lista e os botões ficam desabilitados.
  - Ações: **Copiar**, **Baixar `.md`** / **Baixar `.json`**.
  - Arquivo baixado: nome do grafo sem caracteres proibidos em nome de arquivo (`/\:*?"<>|` e
    controles viram `-`), ou `grafo` se ficar vazio. Copiar mostra o toast "Copiado".
  - A aba JSON nunca é bloqueada: o JSON guarda o grafo como está, inclusive com erros.
  - Prompt gerado segue o template do §6 e é **determinístico** (ordem topológica estável; empate por posição `x`, depois `y`, depois `id`).
- **FR-22 Abrir JSON**: importa arquivo `.json` (ou colar texto). Valida com o schema; erros exibidos com caminho do campo. Migra `schemaVersion` antigas quando houver.
  - Formato (`GraphCodec`, L03): o `Graph` do §3.1 em JSON com 2 espaços de recuo, chaves em ordem
    fixa e `\n` no fim (`encode` → `decode` devolve o mesmo grafo).
  - `decode`: JSON malformado → um item com caminho `$`; campos inválidos → um item por problema,
    com caminho no formato `nodes[2].name`; mensagens em pt-BR. Chaves desconhecidas são ignoradas.
  - Nomes seguem a forma do INV-07/INV-09 (até 80 caracteres percebidos). Unicidade, fios e ciclos
    ficam para o `checkGraph` do `ImportJson`.
  - Só existe a versão 1: `schemaVersion` ausente ou diferente → item no caminho `schemaVersion`.
    Uma versão nova traz a sua migração.
  - Entrada: arrastar um arquivo, escolher pelo botão ou colar o texto. O botão **Abrir grafo** fica
    desabilitado com o texto vazio. Erros do `checkGraph` aparecem com o caminho `nodes[i]` ou
    `edges[i]` e o código do invariante.
  - Grafo válido: é salvo como um grafo novo (`ImportJson`) e aberto; o histórico de desfazer zera.

### Persistência
- **FR-30 Salvamento automático** no IndexedDB a cada mudança (debounce 500 ms). Indicador "Salvo" no topo.
  - Indicador: "● salvo" ou "salvando…"; se o IndexedDB falhar, "não salvo" com toast do motivo.
  - Ao iniciar, abre o grafo mais recente (`ListGraphs`); sem nenhum, cria um e o salva.
  - O `viewport` (pan/zoom) é salvo junto, mas não entra no desfazer nem muda `updatedAt`; ao abrir um
    grafo, o canvas volta ao `viewport` salvo.
  - Trocar de grafo (abrir, novo, importar) grava antes o que estiver pendente e zera o histórico.
- **FR-31 Meus grafos**: modal com lista (nome, nº de peças, atualizado em), ações Abrir, Renomear, Duplicar, Apagar (com confirmação), **Novo grafo**.
  - Lista do mais recente para o mais antigo; a linha do grafo aberto fica destacada.
  - "Atualizado": `hoje, HH:MM`, `ontem, HH:MM` ou `DD/MM/AAAA` (hora local).
  - Renomear: o nome vira um campo na própria linha (Enter grava, Esc cancela); nome inválido
    (INV-09) mostra o motivo. No grafo aberto, renomear é uma edição desfazível.
  - Duplicar (`DuplicateGraph`): id novo, nome "{nome} (cópia)" (cortando o nome original para
    caber em 80 caracteres); não abre a cópia.
  - Apagar o grafo aberto abre o mais recente que sobrar, ou um novo.
- **FR-32 Limpar**: esvazia o grafo atual após confirmação ("Isso apaga todas as peças deste grafo"). Desfazível.
- **FR-33 Título do grafo** no centro do topo, editável inline.
  - Mesmo comportamento do campo Nome do grafo do inspetor (FR-10): um passo de desfazer, erro
    embaixo, volta ao sair se inválido.

### Ajuda
- **FR-40 "?"** abre painel com: descrição das peças, "Como ligar" e atalhos (o mesmo conteúdo da coluna esquerda da captura).

Modais (FR-21, FR-22, FR-31, FR-32, FR-40): `<dialog>` nativo; Esc e ✕ fecham; o foco fica dentro
do modal e volta ao botão que o abriu. Atalhos do editor não agem com um modal aberto.

---

## 5. Requisitos não funcionais

| ID | Requisito |
|---|---|
| NFR-01 | TypeScript 6.x (exigido pelo SvelteKit 3 e pelo `typescript-eslint`; ADR-0003), `strict: true`, `noUncheckedIndexedAccess`, proibido `any` (lint), proibido `ignoreDeprecations` no `tsconfig`. |
| NFR-02 | Camadas `domain` e `application` sem import de Svelte, DOM ou libs de UI (verificado por regra de lint de fronteira). |
| NFR-03 | Cobertura ≥ 90% em `domain` + `application` + `infrastructure` (Vitest; a infraestrutura entra a partir da L03). |
| NFR-04 | 200 peças / 400 fios com pan/zoom a 60 fps num M3; validação < 16 ms. |
| NFR-05 | Funciona offline; nenhum dado sai do navegador. |
| NFR-06 | UI em pt-BR; textos centralizados em `ui/src/lib/i18n/pt-BR.ts`. |
| NFR-07 | Acessibilidade: todas as ações da paleta/inspetor por teclado; foco visível; contraste AA. |
| NFR-08 | Navegadores: Chrome, Safari e Firefox atuais. |

---

## 6. Template do prompt exportado

Gerado por `PromptRenderer` (infra). Exemplo (é o golden file `landing-page.md` da L03):

````markdown
# Grafo: Landing page do produto X

## Objetivo
Entregar a headline e o primeiro parágrafo da landing page do produto X.

## Como executar
Execute as etapas na ordem abaixo. Cada Trabalhador produz um artefato.
Cada Supervisor é um **crítico cego**: passe a ele **apenas o artefato**, nunca o raciocínio
de quem o construiu. Se reprovar, devolva o artefato e o parecer ao(s) construtor(es) e repita,
até as rodadas máx. do Supervisor; esgotadas, siga o "Se esgotar" dele.

## Entrada
Cole aqui o briefing do produto. → alimenta: Trabalhador 1

## Etapas
### 1. Trabalhador 1 (Trabalhador)
Instruções: Escreva 5 headlines para o público do briefing.
Recebe de: Entrada · Envia para: Supervisor 1 · Escreve em: Memória 1

### 2. Supervisor 1 (Supervisor — crítico cego)
A barra: Reprove se a headline não citar o público.
Julga o que vem de: Trabalhador 1 · Rodadas máx.: 3 · Se esgotar: entregar o melhor com ressalvas
Se reprovar, devolve para: Trabalhador 1
Aprovado → Decisão 1

### 3. Decisão 1 (Decisão — escolha UM caminho)
Instruções: Olhe as headlines aprovadas e escolha um caminho.
Recebe de: Supervisor 1
- Se "há mais de uma headline aprovada" → Trabalhador 2
- Se "só uma aprovada" → Entrega 1

### 4. Trabalhador 2 (Trabalhador)
Instruções: Escreva o primeiro parágrafo para cada headline aprovada.
Recebe de: Decisão 1 · Envia para: Entrega 1 · Consulta: Memória 1

### 5. Entrega 1 (Entrega)
Instruções: Monte a headline e o parágrafo finais.
Junte: Decisão 1, Trabalhador 2 → artefato final.

## Memória
- Memória 1 — relações: `ideia`, `descartada_por`. Escrevem: Trabalhador 1. Consultam: Trabalhador 2.
  Guarde cada headline proposta e, quando descartada, o motivo.

## Saída esperada
O artefato de "Entrega 1".

<!-- graph-builder schemaVersion=1 graphId=… -->
````

Regras do renderer (L03):
1. **Geral:** Markdown puro, determinístico (mesmo grafo ⇒ mesmo texto, qualquer que seja a ordem de
   `nodes`/`edges`), sem dados de posição. Seções separadas por uma linha em branco; o texto termina
   com `\n`. Nomes e textos livres entram como estão, sem espaços nas pontas.
2. **Ordem:** a ordem topológica estável do FR-21 vale para as etapas e para toda lista de nomes
   (separados por `, `). As saídas de uma Decisão seguem a ordem do destino.
3. **Seções, nesta ordem:** `# Grafo: {nome}`, `## Objetivo`, `## Como executar`, `## Entrada`
   (só se houver Entrada), `## Etapas`, `## Memória` (só se houver Memória), `## Saída esperada` e o
   rodapé `<!-- graph-builder schemaVersion=1 graphId={id} -->`.
4. **Textos vazios:** objetivo vazio → `_(sem objetivo)_`; instruções vazias → `_(sem instruções)_`;
   condição vazia → `- Se _(sem condição)_ → {destino}`.
5. **Texto de várias linhas** (instruções, barra): o rótulo fica sozinho na linha (`Instruções:`) e
   o texto vem nas linhas seguintes.
6. **Como executar:** a 1ª linha é fixa. O parágrafo do Supervisor só aparece se houver Supervisor
   e não cita número de rodadas (cada Supervisor tem o seu; ele aparece na etapa).
7. **Entrada:** `{instruções} → alimenta: {destinos}`; se ela também grava numa Memória, acrescenta
   ` · escreve em: {memórias}`. Sem destino, só o texto.
8. **Etapas:** todas as peças menos Entrada e Memória, numeradas a partir de 1, com o título
   `### {n}. {nome} ({Tipo}[ — crítico cego | — escolha UM caminho])`. Linhas de ligação juntam as
   partes não vazias com ` · ` e somem se todas estiverem vazias.
   - "Recebe de" = origens de fios `Flow`/`Condition`; "Envia para" = destinos de fios `Flow`;
     "Escreve em" = destinos `MemoryWrite`; "Consulta" = origens `MemoryRead`.
   - **Trabalhador:** `Instruções:`; `Recebe de · Envia para · Escreve em · Consulta`.
   - **Supervisor:** `A barra:`; `Julga o que vem de · Rodadas máx. · Se esgotar` (§3.3);
     `Também recebe de:` (origens que ele não julga, se houver); `Se reprovar, devolve para:`
     (construtores, §3.3, se houver); `Aprovado → {destinos}` (se houver); `Escreve em · Consulta`.
     "Se esgotar": `entregar o melhor com ressalvas` ou `parar e informar a falha`.
   - **Decisão:** `Instruções:`; `Recebe de · Escreve em · Consulta`; um item
     `- Se "{condição}" → {destino}` por fio `Condition`.
   - **Entrega:** `Instruções:`; `Junte: {Recebe de} → artefato final.` (se houver origem);
     `Envia para · Escreve em · Consulta`.
9. **Memória:** um item por Memória:
   `- {nome} — relações: {relações entre crases}. Escrevem: {…}. Consultam: {…}.` Sem relações →
   `relações: livres.`; "Escrevem"/"Consultam" vazios são omitidos. As instruções, se houver, vêm
   na linha de baixo com recuo de 2 espaços.
10. **Saída esperada:** as Entregas finais (sem fio `Flow` de saída). Uma → `O artefato de "{nome}".`;
    várias → `Os artefatos de "{a}", "{b}".`; nenhuma → `_(nenhuma Entrega final)_`.

O renderer não valida: `ExportPrompt` só o chama quando não há erro (§3.5).

---

## 7. Arquitetura

Clean Architecture em monorepo Bun (ADR-0002), com o frontend isolado em `ui/` na raiz.
Bun instala pacotes e executa scripts; Vite, Vitest e Playwright rodam no Node LTS.
Código de `packages/core` e `ui/` não usa APIs `Bun.*` nem `bun:*` (roda no navegador).
A UI usa **Svelte 5** (runes) e **SvelteKit 3** em modo SPA estático, sem SSR e sem servidor (ADR-0003).

```
graph-builder/
├── SPEC.md  CLAUDE.md  HANDOFF.md
├── docs/
│   ├── adr/0001-stack-e-arquitetura.md
│   ├── adr/0002-bun-como-gerenciador-de-pacotes.md
│   ├── adr/0003-ui-em-svelte-e-sveltekit.md
│   └── mockups/mockups.html
├── packages/
│   └── core/                    # framework-free
│       └── src/
│           ├── domain/          # model, invariants, edge-kind derivation, validation, topo sort
│           ├── application/     # use cases + ports
│           └── infrastructure/  # graph-schema, json-codec, prompt-renderer, indexeddb-repository, dagre-layout, system
└── ui/                          # SvelteKit 3 + Svelte 5 + @xyflow/svelte (presentation)
    ├── vite.config.ts           # sveltekit({ adapter: adapter-static, fallback index.html })
    ├── package.json             # "imports": { "#lib/*": "./src/lib/*" } (Kit 3 removeu $lib)
    └── src/
        ├── routes/
        │   ├── +layout.ts       # export const ssr = false
        │   └── +page.svelte     # editor (única rota)
        └── lib/
            ├── canvas/          # inclui mapping.ts (Graph ⇄ SvelteFlow)
            ├── inspector/  palette/  modals/  i18n/
            └── state/           # runes ($state) em .svelte.ts chamando use cases do core
```

### 7.1 Portas (application)
```ts
interface GraphRepository { list(): Promise<GraphSummary[]>; get(id: GraphId): Promise<Graph | null>;
                            save(g: Graph): Promise<void>; delete(id: GraphId): Promise<void> }
interface LayoutEngine   { layout(g: Graph): Map<NodeId, Position> }
interface Clock          { now(): string }
interface IdGenerator    { next(): string }
interface PromptRenderer { render(g: Graph): string }                 // template do §6 (L03)
interface GraphCodec     { encode(g: Graph): string;                  // JSON (L03)
                           decode(text: string): Result<Graph, CodecIssue[]> }
interface GraphSummary   { id: GraphId; name: string; nodeCount: number; updatedAt: string } // FR-31
interface CodecIssue     { path: string; message: string }            // FR-22: caminho do campo
```

### 7.2 Casos de uso
`CreateGraph`, `AddNode`, `ConnectNodes`, `DisconnectEdge`, `UpdateNode`, `MoveNode`,
`DuplicateNode`, `DeleteNode`, `ToggleBarPreset`, `SetEdgeCondition`, `UpdateGraph`, `ValidateGraph`,
`ExportPrompt`, `ExportJson`, `ImportJson`, `AutoLayout`, `ListGraphs`, `OpenGraph`, `SaveGraph`, `DeleteGraph`,
`ClearGraph`.
Todos puros sobre `Graph` imutável (retornam `Result<Graph, DomainError>`), o que torna undo/redo trivial (pilha de snapshots).

Contratos (L02):
- Comandos de edição recebem `{ clock, ids }` e gravam `updatedAt = clock.now()` quando mudam o grafo.
- `AddNode`, `DuplicateNode` e `ConnectNodes` põem o item novo **no fim** de `nodes`/`edges`
  (a UI lê o ID dali para selecionar).
- `AddNode` / `DuplicateNode`: nome `"{Tipo} {n}"`, `n` = menor inteiro ≥ 1 livre entre os nomes
  desse padrão (FR-01, FR-05). Supervisor nasce com `SUPERVISOR_DEFAULTS` e sem presets.
- `UpdateNode`: campos de outro tipo de peça → `NOT_APPLICABLE`. Nome é gravado sem espaços nas
  pontas. Relações da Memória: sem espaços nas pontas, sem vazias, sem repetição.
- `UpdateGraph`: nome (INV-09) e objetivo (FR-10, FR-33).
- `MoveNode`: `snap` opcional arredonda para a grade de 16 px (FR-06).
- `DeleteNode` remove os fios ligados (FR-04). `ClearGraph` esvazia peças e fios; mantém nome,
  objetivo e viewport (FR-32).
- `SetEdgeCondition`: só em fio `Condition`; senão `NOT_APPLICABLE`. Fio inexistente →
  `EDGE_NOT_FOUND`.
- `ExportPrompt`: com erro de validação (§3.5) devolve os itens; senão, o texto do `PromptRenderer`.
- `ImportJson`: `GraphCodec.decode` → `checkGraph` (§3.4). O grafo importado ganha `GraphId` novo
  e `updatedAt = now` (não sobrescreve um grafo salvo).
- Undo/redo (FR-08): histórico em memória com 100 passos; comando sem mudança não entra. A UI
  registra o arraste de peça uma vez, ao soltar.
- `DuplicateGraph` (L06): função pura `duplicateGraph(ctx, graph)`; id novo, nome com " (cópia)",
  `createdAt = updatedAt = now`; peças, fios e viewport iguais.
- `RenameGraph` (L06): `renameGraph(ctx, repo, id, name)` abre, aplica `UpdateGraph` e salva; grafo
  inexistente → `null`; nome inválido → `INV-09`.
- `amend(history, next)` (L05): troca o grafo atual sem criar passo novo nem mexer no `past`; limpa
  o `future`. Usado para juntar as edições de um campo num passo só.

### 7.3 Dependências previstas
- **UI:** `svelte` (5.x), `@sveltejs/kit` (3.x), `@sveltejs/vite-plugin-svelte` (7.x),
  `@sveltejs/adapter-static` (4.x), `@xyflow/svelte` (2.x), `vite` (8.x).
- **Core:** `zod` (4.x), `idb-keyval` (6.x), `@dagrejs/dagre` (3.x, layout). Dev: `fake-indexeddb`
  (6.x), IndexedDB em memória para os testes do repositório, que rodam no Node.
- **Qualidade:** `typescript` (6.x — o SvelteKit 3 não aceita o 7), `svelte-check`, `vitest`,
  `@testing-library/svelte`, `@playwright/test`, `eslint` + `eslint-plugin-boundaries` +
  `eslint-plugin-svelte`, `prettier` + `prettier-plugin-svelte`.

Política (ADR-0003): no scaffold da L00, usar a versão mais atual de cada pacote compatível com
o Svelte e o SvelteKit mais atuais. Versões de referência em 2026-11-18: ver tabela do ADR-0003.
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
| 00 | `feature/layer-00-scaffold` | monorepo Bun (workspaces, `bunfig.toml`, `bun.lock`), tsconfig strict, ESLint boundaries, Vitest, SvelteKit vazio (adapter-static, `ssr = false`) | `bun run --filter '*' typecheck && bun run --filter '*' lint` | `v0.0.1` |
| 01 | `feature/layer-01-domain` | model, INV-01..08, derivação de fio, topo sort, VAL-01..10 | testes de domínio ≥ 90% | `v0.1.0` |
| 02 | `feature/layer-02-application` | casos de uso + portas + undo/redo | testes de casos de uso | `v0.2.0` |
| 03 | `feature/layer-03-infrastructure` | zod schema, JSON codec, PromptRenderer (golden tests), IndexedDB repo, dagre | golden files do §6 batem | `v0.3.0` |
| 04 | `feature/layer-04-ui-canvas` | canvas, paleta, peças, fios, controles de visão, desfazer/refazer (FR-01..09) | Playwright: criar/ligar/cortar/duplicar | `v0.4.0` |
| 05 | `feature/layer-05-ui-panels` | inspetores M2–M5, painel "Antes de exportar" | Playwright: validação ao vivo | `v0.5.0` |
| 06 | `feature/layer-06-ui-io` | modais M6–M8, Meus grafos, autosave | Playwright: export→import ida e volta | `v1.0.0` |

Escopo da L06: barra do topo (FR-33), modais M6–M8, Limpar, Ajuda e salvamento automático (FR-21,
FR-22, FR-30..33, FR-40); e2e em Chrome, Firefox e WebKit (Safari) do Playwright.

Escopo da L05: inspetor (FR-10..15) e painel "Antes de exportar" (FR-20); exportação e modais na L06.

Escopo da L04: o grafo fica só em memória (salvamento automático e botões do topo na L06); o
painel direito mostra um texto provisório (inspetor na L05).

Merge em `develop` ao fim de cada camada; `master` (branch principal) só em `v1.0.0`.

Depois da v1 (Git flow): trabalho novo em `feature/…` ou `fix/…` a partir da `develop`, com merge
nela; a release vai da `develop` para a `master` com tag `vX.Y.Z`. A worktree do Claude fica na
própria branch (`claude/…`), porque a `develop` está aberta no checkout principal e o Git não abre
uma branch em dois worktrees.

### 9.2 Deploy (GitHub Pages)
O build é publicado em `https://joao-parana.github.io/graph-builder/` pelo workflow
`.github/workflows/pages.yml`, a cada push na `master` (release) ou por disparo manual. O subcaminho
vem da variável de ambiente `BASE_PATH` (`kit.paths.base`): o workflow usa `/graph-builder`; vazia
(padrão), o app fica na raiz, como em dev, `vite preview` e e2e. Os grafos ficam no IndexedDB da
origem `joao-parana.github.io` (banco `graph-builder`).

### 9.1 Gates (rodar em terminal ZSH separado, saída em `/tmp/gates.txt`)
O e2e (`bun run --filter ui e2e`, a partir da L04) usa o Google Chrome instalado
(`channel: 'chrome'`, NFR-08); a partir da L06 também Firefox e WebKit (motor do Safari) do Playwright.
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
| Q1 | O ponto dourado no topo das peças é o retorno do Supervisor ou outra porta? | **Resolvida:** âncora só visual do retorno implícito, em Trabalhador e Entrega; não é porta (§3.3) | L01 |
| Q2 | `maxRounds` / `onExhausted` existem no original? | **Resolvida:** sim (o mockup M3 já os mostra). Padrão 3 / entregar o melhor com ressalvas; faixa 1..10 (INV-08) | L01 |
| Q3 | Supervisor pode julgar uma Entrega (não só Trabalhador)? | **Resolvida:** sim. Julga `Flow` vindo de Trabalhador, Entrega ou Supervisor (em série, com construtores por recursão); Entrada não (§3.3) | L01 |
| Q4 | Gerenciador de pacotes: pnpm ou bun? | **Resolvida:** Bun ≥ 1.3, só para pacotes e scripts (ADR-0002) | L00 |
| Q5 | Cortar fio com 1 clique (como diz a ajuda original) ou 2? | **Resolvida:** 2 passos (clique seleciona; 2º clique ou `Del` remove) + undo (FR-03) | L04 |
| Q6 | Presets extras além de "Resultado WOW" e "Sem erros" | **Resolvida:** os 4 presets do FR-12, com ids e textos definidos (o `ToggleBarPreset` da L02 precisa deles) | L05 |
