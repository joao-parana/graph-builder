# SPEC — Graph Builder (editor visual de grafos de agentes)

> **Status:** Draft v0.1 · **Data:** 2026-11-13 · **Dono:** João
> **v2 (proposta, 2026-11-19, ADR-0004):** conta e grafos na nuvem com Supabase — §1, §1.3, §2,
> FR-50..56, NFR-05/09/10, §7.1–§7.4, §9 (L07–L09), §10, §12 (Q7–Q9). Nada da v2 é implementado
> antes de o ADR-0004 ser aceito (aceito em 2026-11-19); Q7, Q8 e Q9 resolvidas.
> **Contrato:** este arquivo é a fonte da verdade. Mudança de comportamento = mudança aqui primeiro.
> **Origem:** inspirado na ferramenta mostrada em <https://www.youtube.com/watch?v=r8JueeaKJ9w>.
> A página do vídeo não pôde ser lida; esta spec foi derivada de uma captura de tela.
> Itens marcados **[INFERIDO]** não aparecem explicitamente na captura e devem ser validados (ver §12).

---

## 1. Visão

Um editor web, local por padrão, onde o desenvolvedor **desenha um grafo de agentes** (quem constrói,
quem julga, onde decide, o que se lembra) e **exporta** esse grafo como:

1. um **prompt Markdown** pronto para colar no Claude (Claude Code / Claude Desktop), que descreve
   o fluxo de execução, os papéis e os critérios de aprovação; e
2. um **JSON versionado**, reimportável, que é o formato de persistência do próprio grafo.

O app **não executa** o grafo. Ele modela e gera a especificação; quem executa é o Claude.

Na v2, o app tem **dois modos** (ADR-0004): o **local** (a v1: grafos no navegador, offline, sem
conta) e a **nuvem** (grafos guardados no Supabase, por usuário, só para convidados). O app continua
estático, sem servidor próprio.

### 1.1 Objetivos
- G1 — Modelar visualmente grafos com 6 tipos de peça e regras de ligação claras.
- G2 — Impedir/alertar grafos mal formados antes da exportação ("Antes de exportar").
- G3 — Exportar um prompt determinístico (mesmo grafo ⇒ mesmo texto) e um JSON reimportável.
- G4 — Guardar vários grafos localmente ("Meus grafos").
- G5 (v2) — Guardar os grafos de cada usuário na nuvem, com acesso restrito a convidados.

### 1.2 Fora de escopo (v1)
- Executar o grafo / chamar a API do Claude.
- Contas, login, nuvem, colaboração em tempo real (o botão "Sair" da captura **não** entra).
  → Contas e nuvem entram na v2 (§1.3); colaboração continua fora.
- Botão "Feedback".
- Exportar direto para formatos nativos do Claude Code (skills, subagents, workflows) → v2 (§11).

### 1.3 Escopo da v2 (ADR-0004)
- **Entra:** login com GitHub (Supabase Auth); acesso só para convidados; grafos na nuvem por
  usuário; escolha entre os modos local e nuvem; cópia de grafos entre os modos.
- **Fora:** compartilhar grafos entre usuários, colaboração em tempo real, sincronização automática
  entre os modos, uso offline da nuvem, papéis (admin/usuário), cadastro aberto, outros provedores
  de login.

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
| Modo | `StorageMode` (`'local' \| 'cloud'`) | Onde os grafos abertos e listados ficam guardados (v2). |
| Neste navegador | `StorageMode` `'local'` | Modo local: IndexedDB, offline, sem conta (a v1). |
| Na nuvem | `StorageMode` `'cloud'` | Modo nuvem: tabela `graphs` do Supabase, só com sessão (v2). |
| Conta | `Account` | Usuário convidado, identificado pelo login do GitHub (v2). |
| Convidado | — | Pessoa que o dono cadastrou no Supabase; só ela entra na nuvem (v2). |

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

### Conta e nuvem (v2, ADR-0004)
Valem só quando o build tem o Supabase configurado (§9.2). Sem ele, o app é a v1: nada desta seção
aparece.
- **FR-50 Entrar com GitHub:** botão "Entrar com GitHub" no topo, sem sessão (M9).
  - Dado o modo local, quando o usuário clica em "Entrar com GitHub", então vai ao GitHub (OAuth via Supabase,
    PKCE) e volta para a raiz do app.
  - Na volta com sucesso: o topo mostra o login do GitHub (e o avatar, se houver); o modo passa a
    "Na nuvem"; abre o grafo mais recente da nuvem ou, sem nenhum, cria um e o salva (como FR-30).
  - A URL perde os parâmetros do retorno (`?code=…`) sem recarregar a página.
  - O grafo local que estava aberto é gravado antes de sair para o GitHub.
  - Enquanto o app troca o `?code=` pela sessão, o botão mostra "Entrando…" e fica desabilitado.
  - Falha na troca (rede, servidor): fica no modo local e mostra o aviso de login (FR-51) com
    "Não foi possível entrar agora. Tente de novo.".
- **FR-51 Acesso negado:** conta do GitHub sem convite (ou login cancelado).
  - Sem convite, o Supabase volta com `error_code=signup_disabled` (Q7) ou, sem esse código, com
    `error_description` que contém "Signups not allowed" (sem diferenciar maiúsculas); cancelado no
    GitHub, com `error=access_denied` sem nenhum dos dois. Os parâmetros podem vir na query ou no
    fragmento (`#`).
  - O app fica no modo local, sem sessão, e mostra: "Sua conta do GitHub não tem acesso à nuvem.
    Peça um convite." (cancelado: nenhuma mensagem). Nenhum dado local muda.
  - **Aviso de login:** a mensagem da volta do login (sem convite, ou a falha da FR-50) abre num
    modal de alerta (`role="alertdialog"`, título "Entrar com GitHub", botão "Entendi"). Ele não
    some sozinho: fica até o usuário clicar em "Entendi", no ✕ ou apertar Esc. O usuário pode
    perder um toast enquanto o app carrega; o modal garante que ele leia.
- **FR-52 Sair:** menu do usuário no topo (avatar + `@login`) → "Sair" (M9).
  - Grava o que estiver pendente na nuvem, encerra a sessão, volta ao modo local e abre o grafo
    local mais recente (FR-30).
- **FR-53 Trocar de modo:** seletor "Neste navegador | Na nuvem" no topo (rótulo acessível "Onde
  salvar", M9); "Na nuvem" só com sessão — sem ela, fica desabilitado com a dica "Entre com o GitHub
  para usar a nuvem".
  - Trocar grava antes o que estiver pendente, zera o histórico e abre o grafo mais recente do modo
    escolhido (como trocar de grafo, FR-30).
  - O navegador lembra o último modo (Q8); ao iniciar com sessão válida, abre nele.
  - "Meus grafos" (FR-31) lista só os grafos do modo atual e diz qual é no título: "Meus grafos —
    neste navegador" ou "Meus grafos — na nuvem" (M10).
- **FR-54 Copiar entre modos:** em "Meus grafos", ação por linha "Copiar para a nuvem" (modo local,
  com sessão) ou "Copiar para este navegador" (modo nuvem).
  - A cópia ganha `GraphId` novo, o mesmo nome e `updatedAt = now`; o original não muda; a cópia não
    abre. Toast "Copiado para a nuvem" / "Copiado para este navegador".
  - Quando a ação de cópia aparece, Renomear, Duplicar e Apagar vão para um menu "⋯" (rótulo
    acessível "Mais ações") na linha, para caber; sem sessão no modo local, a linha fica como no M7.
- **FR-55 Salvamento na nuvem:** mesmo comportamento do FR-30 (debounce 500 ms, indicador, viewport).
  - Falha de rede ou do Supabase: "não salvo" + toast "Não foi possível salvar na nuvem: {motivo}";
    sem conexão, o toast é "Sem conexão: as mudanças serão salvas quando a conexão voltar."; a edição continua em memória e o
    salvamento é tentado de novo na próxima mudança e quando o navegador volta a ficar online.
- **FR-56 Sessão expirada:** se a sessão não puder ser renovada, o indicador fica "não salvo", o
  toast diz "Sua sessão expirou. Entre de novo." e o topo volta a mostrar "Entrar com GitHub".
  - O grafo aberto continua em memória. Entrar de novo leva ao GitHub e recarrega o app, o que
    perderia a memória; por isso, ao clicar "Entrar com GitHub" com o indicador "não salvo" no modo
    nuvem, o app antes guarda o grafo aberto neste navegador (mesmo `GraphId`) e avisa "O grafo não
    salvo na nuvem foi guardado neste navegador.".
  - Na volta, o modo nuvem abre o grafo mais recente da nuvem; o guardado fica em "Meus grafos —
    neste navegador", de onde pode ser copiado para a nuvem (FR-54).

Textos da v2 (NFR-06: em `ui/src/lib/i18n/pt-BR.ts`, na chave `cloud`):

| Onde | Texto |
|---|---|
| Botão de login (FR-50) | "Entrar com GitHub"; durante a troca do código: "Entrando…" |
| Seletor de modo (FR-53) | rótulo "Onde salvar"; opções "Neste navegador" e "Na nuvem"; dica sem sessão: "Entre com o GitHub para usar a nuvem" |
| Menu do usuário (FR-52) | "@{login}" (rótulo acessível "Conta @{login}"); item "Sair" |
| Título de "Meus grafos" (FR-53) | "Meus grafos — neste navegador" / "Meus grafos — na nuvem" |
| Ação por linha (FR-54) | "Copiar para a nuvem" / "Copiar para este navegador"; menu "⋯" com rótulo "Mais ações" |
| Aviso de login (FR-51) | título "Entrar com GitHub"; botão "Entendi"; mensagens "Sua conta do GitHub não tem acesso à nuvem. Peça um convite." e "Não foi possível entrar agora. Tente de novo." |
| Toasts | "Copiado para a nuvem"; "Copiado para este navegador"; "Não foi possível entrar agora. Tente de novo." (ao sair para o GitHub); "Não foi possível salvar na nuvem: {motivo}"; "Sem conexão: as mudanças serão salvas quando a conexão voltar."; "Sua sessão expirou. Entre de novo."; "O grafo não salvo na nuvem foi guardado neste navegador." |
| Ajuda (FR-40) | seção "Conta e nuvem": "Sem conta, os grafos ficam só neste navegador. Com o GitHub, convidados guardam grafos na nuvem e os abrem em outro computador. Em Meus grafos, copie um grafo de um lugar para o outro." |

---

## 5. Requisitos não funcionais

| ID | Requisito |
|---|---|
| NFR-01 | TypeScript 6.x (exigido pelo SvelteKit 3 e pelo `typescript-eslint`; ADR-0003), `strict: true`, `noUncheckedIndexedAccess`, proibido `any` (lint), proibido `ignoreDeprecations` no `tsconfig`. |
| NFR-02 | Camadas `domain` e `application` sem import de Svelte, DOM ou libs de UI (verificado por regra de lint de fronteira). |
| NFR-03 | Cobertura ≥ 90% em `domain` + `application` + `infrastructure` (Vitest; a infraestrutura entra a partir da L03). |
| NFR-04 | 200 peças / 400 fios com pan/zoom a 60 fps num M3; validação < 16 ms. |
| NFR-05 | **Modo local:** funciona offline; nenhum dado sai do navegador. **Modo nuvem (v2):** só o JSON do grafo (`GraphCodec`) e a sessão trafegam, e só para o projeto Supabase do app; nenhum outro serviço recebe dados; sem telemetria. |
| NFR-06 | UI em pt-BR; textos centralizados em `ui/src/lib/i18n/pt-BR.ts`. |
| NFR-07 | Acessibilidade: todas as ações da paleta/inspetor por teclado; foco visível; contraste AA. |
| NFR-08 | Navegadores: Chrome, Safari e Firefox atuais. |
| NFR-09 | Segurança da nuvem (v2): RLS ativo em toda tabela, com política por dono (`owner_id = auth.uid()`); cadastro público desligado; só a URL e a chave pública do Supabase vão no bundle (nunca a *service role key*); sem `{@html}` com dado do usuário; CSP por `<meta>` (§9.4). |
| NFR-10 | Testes da nuvem (v2) rodam contra o Supabase local (Supabase CLI, Docker), nunca contra o projeto de produção; o esquema e as políticas vêm só de `supabase/migrations/`. |

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
│   ├── adr/0004-conta-e-nuvem-com-supabase.md
│   └── mockups/mockups.html
├── packages/
│   └── core/                    # framework-free
│       └── src/
│           ├── domain/          # model, invariants, edge-kind derivation, validation, topo sort
│           ├── application/     # use cases + ports
│           └── infrastructure/  # graph-schema, json-codec, prompt-renderer, indexeddb-repository, dagre-layout, system
│                                # v2: supabase-graph-repository, supabase-auth-gateway
├── supabase/                    # v2: config.toml + migrations/ (esquema e RLS, §7.4)
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

// v2 (ADR-0004)
type StorageMode = 'local' | 'cloud';
interface Account        { id: string; login: string; avatarUrl: string | null } // FR-50
type AuthError = 'NOT_INVITED' | 'CANCELLED' | 'NETWORK';                     // FR-51
interface AuthGateway    { account(): Promise<Account | null>;               // sessão atual
                           signIn(): Promise<void>;                          // redireciona ao GitHub
                           completeSignIn(): Promise<Result<Account, AuthError> | null>; // na volta; null = não é volta de login
                           signOut(): Promise<void>;
                           onChange(listener: (a: Account | null) => void): () => void } // FR-56
```
`SupabaseGraphRepository` implementa o mesmo `GraphRepository`: a UI escolhe o repositório pelo modo.

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
- `CopyGraph` (v2, FR-54): `copyGraph(ctx, from, to, id)` abre em `from`, dá `GraphId` novo e
  `updatedAt = now`, salva em `to`; grafo inexistente → `null`.
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

- **v2 (ADR-0004):** `@supabase/supabase-js` (2.x, só em `infrastructure`). Dev: `supabase` (CLI,
  3.x) para o banco local e as migrations.

Política (ADR-0003): no scaffold da L00, usar a versão mais atual de cada pacote compatível com
o Svelte e o SvelteKit mais atuais. Versões de referência em 2026-11-18: ver tabela do ADR-0003.
(Instalação só após OK — ver CLAUDE.md.)

### 7.4 Dados na nuvem (v2, ADR-0004)
```sql
create table public.graphs (
  owner_id   uuid        not null default auth.uid() references auth.users on delete cascade,
  id         text        not null,                 -- GraphId
  name       text        not null,                 -- cópia de data.name, para a lista (FR-31)
  node_count integer     not null,                 -- idem
  updated_at timestamptz not null,                 -- idem; ordena a lista
  data       jsonb       not null,                 -- JSON versionado do GraphCodec
  primary key (owner_id, id)
);
alter table public.graphs enable row level security;
create policy graphs_owner on public.graphs for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
```
- `list()` lê só `id, name, node_count, updated_at` (sem `data`), do mais recente para o mais antigo.
- `get()` passa `data` pelo `GraphCodec.decode`; JSON inválido é erro do repositório, não grafo
  vazio.
- `save()` é um *upsert* por `(owner_id, id)`.

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
| M9 | Topo com conta (v2): sem sessão, entrando, na nuvem com menu do usuário, aviso de acesso negado | FR-50..53, FR-56 |
| M10 | "Meus grafos" por modo (v2): neste navegador e na nuvem, com a cópia entre modos | FR-53, FR-54 |

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
| 07 | `feature/layer-07-cloud-infra` | migrations + RLS (§7.4), `SupabaseGraphRepository`, `SupabaseAuthGateway`, `copyGraph` | integração contra o Supabase local, incluindo RLS entre dois usuários; cobertura (NFR-03) | `v1.2.0` |
| 08 | `feature/layer-08-ui-account` | Entrar/Sair, seletor de modo, Meus grafos por modo, copiar entre modos, erros de rede e sessão (FR-50..56) | Playwright com Supabase local; login real pelo GitHub no Supabase local (convidado entra, não convidado → `signup_disabled`, Q7) | `v1.3.0` |
| 09 | `feature/layer-09-cloud-release` | variáveis no Actions, URLs de retorno no Supabase, CSP, README, deploy | login real conferido no Pages com um convidado e um não convidado | `v2.0.0` |

Escopo da L06: barra do topo (FR-33), modais M6–M8, Limpar, Ajuda e salvamento automático (FR-21,
FR-22, FR-30..33, FR-40); e2e em Chrome, Firefox e WebKit (Safari) do Playwright.

Escopo da L05: inspetor (FR-10..15) e painel "Antes de exportar" (FR-20); exportação e modais na L06.

Escopo da L04: o grafo fica só em memória (salvamento automático e botões do topo na L06); o
painel direito mostra um texto provisório (inspetor na L05).

Escopo da v2 (L07–L09): §1.3, FR-50..56, NFR-09/10, §7.4. Q7, Q8 e Q9 resolvidas (§12); variáveis do build em §9.3; CSP em §9.4; gate manual da L09 em §9.5.

Merge em `develop` ao fim de cada camada; `master` (branch principal) só em `v1.0.0`.

Depois da v1 (Git flow): trabalho novo em `feature/…` ou `fix/…` a partir da `develop`, com merge
nela; a release vai da `develop` para a `master` com tag `vX.Y.Z`. A worktree do Claude fica na
própria branch (`claude/…`), porque a `develop` está aberta no checkout principal e o Git não abre
uma branch em dois worktrees.

### 9.1 Gates (rodar em terminal ZSH separado, saída em `/tmp/gates.txt`)
O e2e (`bun run --filter ui e2e`, a partir da L04) usa o Google Chrome instalado
(`channel: 'chrome'`, NFR-08); a partir da L06 também Firefox e WebKit (motor do Safari) do Playwright.
```zsh
{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; } 2>&1 | tee /tmp/gates.txt
```
A partir da L07, o gate roda com o Supabase local no ar (`bun run db:start` antes; Docker). Sem ele,
os testes da nuvem são pulados com aviso e a cobertura da `infrastructure` não vale como gate.

### 9.2 Deploy (GitHub Pages)
O build é publicado em `https://joao-parana.github.io/graph-builder/` pelo workflow
`.github/workflows/pages.yml`, a cada push na `master` (release) ou por disparo manual. O subcaminho
vem da variável de ambiente `BASE_PATH` (`kit.paths.base`): o workflow usa `/graph-builder`; vazia
(padrão), o app fica na raiz, como em dev, `vite preview` e e2e. Os grafos ficam no IndexedDB da
origem `joao-parana.github.io` (banco `graph-builder`).
- **v2 (L09):** o build do modo nuvem recebe `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_KEY` (chave
  pública) como *variables* do GitHub Actions. Sem elas, o build é só local (FR-50). No Supabase, as
  URLs de retorno permitidas são `https://joao-parana.github.io/graph-builder/` e as de dev/preview.
  - Local, o login usa `127.0.0.1`, não `localhost`: o Supabase local manda ao GitHub o callback
    `http://127.0.0.1:54321/auth/v1/callback` (o do OAuth App de dev tem que ser igual), e o Safari
    pode forçar `https://` em `localhost` (HSTS guardado de outro app).
  - O `dev:cloud` ouve em `127.0.0.1:5173` e a `site_url` local é `http://127.0.0.1:5173/`; as
    voltas permitidas são `127.0.0.1` e `localhost` nas portas 5173 (dev) e 4173 (preview/e2e).

### 9.3 Variáveis do build (v2, L08)
- Declaradas em `ui/src/env.ts` com `defineEnvVars` (SvelteKit 3; o `$env/static/public` está
  deprecado) e lidas de `$app/env/public`:

  | Variável | Valor | Config |
  |---|---|---|
  | `PUBLIC_SUPABASE_URL` | URL do projeto (`http(s)://…`) | `public: true`, `static: true`, opcional |
  | `PUBLIC_SUPABASE_KEY` | chave pública (`sb_publishable_…` ou a `anon` antiga) | `public: true`, `static: true`, opcional |

- `static: true`: o valor entra no bundle no build. O código da nuvem (`supabase-js` e adaptadores)
  fica num chunk à parte, carregado por `import()` só quando as duas existem; sem elas, o app não o
  baixa e é a v1.
- O modo nuvem só existe com **as duas** preenchidas. Só uma preenchida é erro de configuração: o
  build falha com a mensagem "Defina PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_KEY juntas (ou nenhuma)".
- O `schema` da URL rejeita o que não for `http://` ou `https://`; a *service role key*
  (`sb_secret_…` ou JWT com `role: service_role`) é rejeitada no build (NFR-09).
- A volta do login (`redirectTo`) é a raiz do app: origem + `kit.paths.base` + `/`.
- **Dev e e2e com nuvem:** os valores vêm do `supabase status` local, por script
  (`bun run --filter ui dev:cloud`), nunca de arquivo versionado. Arquivos `.env*` ficam no
  `.gitignore`.

### 9.4 CSP (v2, L09; NFR-09)
O GitHub Pages não deixa definir cabeçalhos, então a CSP vai numa `<meta http-equiv>` no
`index.html`, gerada pelo `kit.csp` do SvelteKit (`mode: 'hash'`). O `index.html` é o *fallback*
do `adapter-static`, renderizado no build: o SvelteKit calcula o hash do script inline de
inicialização e o põe no `script-src`. A `<meta>` vale onde o `build/` é servido como arquivo
estático (Pages, outra hospedagem). O `vite preview` (e2e) e o `vite dev` renderizam a página na
hora e mandam as mesmas diretivas por cabeçalho; o `vite dev` ainda libera estilos inline.

| Diretiva | Valor | Por quê |
|---|---|---|
| `default-src` | `'self'` | o resto vem só da origem do app |
| `script-src` | `'self'` + hash do script inline (automático) | sem `'unsafe-inline'` nem `'unsafe-eval'`: o que barra XSS |
| `style-src` | `'self' 'unsafe-inline'` | o `@xyflow/svelte` e as diretivas `style:` do Svelte usam atributos `style` |
| `img-src` | `'self' data:` | sem imagens de fora (avatar do GitHub não é usado; NFR-05) |
| `font-src` | `'self'` | sem fontes de fora |
| `connect-src` | `'self'` + origem de `PUBLIC_SUPABASE_URL`, se houver | NFR-05: só o projeto Supabase recebe dados |
| `object-src` | `'none'` | sem plugins |
| `base-uri` | `'self'` | barra `<base>` injetado |
| `form-action` | `'none'` | o app não envia formulários; o login é um redirecionamento |

- A origem do Supabase é `new URL(PUBLIC_SUPABASE_URL).origin` (ex.: `https://<ref>.supabase.co`;
  local, `http://127.0.0.1:54321`). Sem as variáveis (build só local, FR-50), o `connect-src` é só
  `'self'`. Só HTTP: o app não usa Realtime (sem `wss:`).
- As diretivas saem de uma função pura `cspDirectives(supabaseUrl?)` em `ui/src/lib/cloud/csp.ts`,
  chamada pelo `vite.config.ts` (como `checkSupabasePair`), com teste unitário.
- `frame-ancestors`, `report-uri` e `sandbox` não funcionam em `<meta>`: sem proteção contra
  *clickjacking* no Pages (risco aceito: não há ação de um clique só que cause dano sem
  confirmação). Sem `upgrade-insecure-requests`, que quebraria o Supabase local em `http://`.
- O `zod` 4 testa `new Function` para compilar validadores; com a CSP isso falha e ele usa o modo
  sem JIT. Para não gerar violação no console, o core liga `jitless` na configuração do `zod`.
- **e2e:** o `build/index.html` tem a `<meta>` e o `vite preview` manda o cabeçalho, os dois com o
  hash no `script-src` e o `connect-src` esperado. Os specs importam `test` de `ui/e2e/csp.ts`,
  cuja fixture automática faz qualquer teste falhar se houver um `securitypolicyviolation`.

### 9.5 Gate manual da L09 (produção)
Pré-requisitos (feitos pelo usuário, sem segredo no repositório):
- projeto Supabase de produção com `supabase/migrations/` aplicadas, cadastro desligado ("Allow new
  users to sign up"), Site URL e URL de retorno `https://joao-parana.github.io/graph-builder/`;
- OAuth App de produção no GitHub com o callback `https://<ref>.supabase.co/auth/v1/callback`; o
  *client id* e o *secret* ficam só no painel do Supabase;
- *variables* `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_KEY` (chave pública) no repositório do
  GitHub; release na `master` e deploy do Pages concluído;
- um usuário convidado no painel, com e-mail verificado na conta do GitHub dele, e uma segunda
  conta do GitHub sem convite.

Roteiro, em `https://joao-parana.github.io/graph-builder/`, no Chrome e no Safari:
1. O topo mostra "Onde salvar" e "Entrar com GitHub"; o console não tem violação de CSP.
2. Com o convidado: Entrar → GitHub → volta com `@login` e "Na nuvem". Criar um grafo, recarregar a
   página: continua lá, e a linha aparece em `public.graphs` no painel.
3. Copiar um grafo de "Neste navegador" para "Na nuvem" e de volta (FR-54).
4. Sair: volta para "Neste navegador", com os grafos locais intactos.
5. Com a conta sem convite: aviso "Sua conta do GitHub não tem acesso à nuvem. Peça um convite."
   e o app segue no modo local.
6. Na aba Rede, durante os passos 2–5, só há pedidos à origem do app, ao projeto Supabase e ao
   `github.com` (login) (NFR-05).

O resultado vai para o `HANDOFF.md` antes da tag `v2.0.0`.

---

## 10. Estratégia de testes
- **Domínio:** tabela de casos para cada INV e VAL; testes de propriedade (fast-check) para "nenhum comando aceito produz grafo que viola invariante".
- **Renderer:** golden files em `packages/core/test/golden/*.md`; determinismo testado renderizando 2× com nós embaralhados.
- **Codec:** round-trip `Graph → JSON → Graph` idêntico; JSONs inválidos de exemplo com mensagens esperadas.
- **E2E (Playwright):** fluxos M1–M10 (M9 e M10 com o Supabase local, Q9).
- **Nuvem (v2, NFR-10):** os mesmos testes de contrato do `GraphRepository` rodam no IndexedDB
  (fake) e no `SupabaseGraphRepository` (Supabase local); testes de RLS com dois usuários (um não lê,
  não grava e não apaga o grafo do outro; sem sessão, nada); e2e do modo nuvem com sessão injetada
  (Q9).
  - Os testes leem a URL e as chaves do `supabase status` local; a *service role key* só cria e
    apaga usuários de teste. Sem o Supabase local no ar, esses testes são pulados com aviso.
  - `bun run db:start` / `db:stop` / `db:reset` (raiz) sobem, param e recriam o banco local a partir
    de `supabase/migrations/`.

---

## 11. Evoluções (v2+, não implementar agora)
- Exportar como **skill** / **subagents** / workflow do Claude Code (um arquivo por peça).
- Rodar o grafo via API (Claude Agent SDK) com visualização do progresso por peça.
- Biblioteca de grafos-modelo (pipeline com crítico, diamante fan-out/fan-in).
- Sub-grafo: Entrega de um grafo alimentando outro ("fase seguinte").
- Depois da v2 (ADR-0004): compartilhar grafos entre usuários, sincronização automática entre os
  modos, papéis (admin/usuário).
- **Parâmetros do grafo.** *Hoje, sem mudar o app (convenção):* um valor que muda a cada execução
  vira um marcador `{{nome}}` (chaves duplas, `nome` em `[a-z][a-z0-9_]*`) no Objetivo, nas
  Instruções ou na barra, com os padrões numa linha do Objetivo (`Parâmetros: max_palavras (padrão:
  120).`). O renderer copia o texto como está (§6, regra 1), e quem executa troca os marcadores
  pelos valores antes de montar o pacote do crítico, para a barra chegar resolvida ao Supervisor
  sem quebrar a cegueira. Chave simples (`{público}`) segue como texto literal. *Evolução:*
  `Graph.parameters` (`name`, `description`, `defaultValue`); INV-10 (nome válido e único,
  case-insensitive); VAL-11 (erro: marcador sem declaração) e VAL-12 (alerta: parâmetro sem uso);
  seção `## Parâmetros` no prompt, depois de `## Objetivo`, só quando houver (o renderer não
  resolve valores: o prompt segue função só do grafo, §6 regra 1); `schemaVersion: 2`, com migração
  v1→v2 (`parameters: []`) no codec e na leitura do IndexedDB (a nuvem passa pelo codec; `data`
  é `jsonb`, sem migration SQL). Pede camada própria, com ADR (sintaxe do marcador e primeira
  migração de schema). Análise das alternativas e do impacto por arquivo:
  `graph-examples/anotacoes/parametros-do-grafo.md` (laboratório dos tutoriais, repositório
  próprio, fora deste).
- **Checagens por regra na barra** (gates determinísticos). *Hoje, sem mudar o app (convenção):*
  a skill `/executar-grafo` do laboratório reconhece, numa lista fechada, as linhas da barra
  mensuráveis (`Reprove se … passar de N palavras`, `… tiver menos de N palavras`, `… passar de N
  caracteres`, `… não começar com "texto"`) e as confere por script **antes** do crítico. Um gate
  reprovado devolve o artefato com um parecer gerado pelo script, sem chamar o crítico; o crítico
  recebe só as linhas que não são gate e nunca o resultado delas (a cegueira se mantém). Testado
  no tutorial 01: o crítico estimava a contagem ("cerca de 238"), o script conta exato.
  *Evolução:* `SupervisorNode.checks: BarCheck[]`, com `BarCheck = { kind: 'max-words' |
  'min-words' | 'max-chars' | 'starts-with'; value: string }` (`value` é número, texto ou um
  marcador `{{nome}}` dos Parâmetros do grafo); INV-11 (`value` numérico inteiro ≥ 1 nos três
  primeiros tipos, não vazio em `starts-with`, ou um marcador válido); VAL-13 (erro: checagem com
  marcador sem parâmetro declarado) e VAL-14 (alerta: duas checagens do mesmo tipo no mesmo
  Supervisor); no inspetor, um bloco "Checagens por regra" abaixo da barra, com tipo e valor; no
  prompt, uma linha `Checagens por regra:` no bloco do Supervisor, depois de `A barra:`, uma
  checagem por item, no texto canônico que o executor reconhece sem adivinhar (Q10); `Como
  executar` ganha uma frase: as checagens rodam por script antes do crítico e não vão para o
  pacote dele. Muda o schema: entra na mesma camada e na mesma migração (`schemaVersion: 2`) dos
  Parâmetros do grafo (`checks: []` na migração v1→v2).
- **Supervisor por nota.** Hoje a barra é binária (aprovado/reprovado). *Evolução:* modo opcional
  em que o crítico dá uma nota 0–100 e aprova com `scoreMin`; e `candidates` (1..5, padrão 1): o
  construtor gera N versões por rodada e o crítico, sem saber qual veio de qual rodada, ranqueia e
  fica a melhor. Muda `SupervisorNode`, o template §6 e o schema. Só se os tutoriais 04 (críticos
  em série) ou 05 (Entrega julgada) mostrarem a necessidade.
- **Aprovação humana explícita.** Uma peça (ou marcação no Supervisor) de "pausa: o usuário aprova
  antes de seguir", que o prompt traduz como "pare e pergunte". É peça nova (§3, §6, VAL, paleta):
  custo alto, fica só como registro.

---

## 12. Questões abertas (decidir antes da camada indicada)

| # | Questão | Proposta padrão | Até |
|---|---|---|---|
| Q1 | O ponto dourado no topo das peças é o retorno do Supervisor ou outra porta? | **Resolvida:** âncora só visual do retorno implícito, em Trabalhador e Entrega; não é porta (§3.3) | L01 |
| Q2 | `maxRounds` / `onExhausted` existem no original? | **Resolvida:** sim (o mockup M3 já os mostra). Padrão 3 / entregar o melhor com ressalvas; faixa 1..10 (INV-08) | L01 |
| Q3 | Supervisor pode julgar uma Entrega (não só Trabalhador)? | **Resolvida:** sim. Julga `Flow` vindo de Trabalhador, Entrega ou Supervisor (em série, com construtores por recursão); Entrada não (§3.3) | L01 |
| Q4 | Gerenciador de pacotes: pnpm ou bun? | **Resolvida:** Bun ≥ 1.3, só para pacotes e scripts (ADR-0002) | L00 |
| Q5 | Cortar fio com 1 clique (como diz a ajuda original) ou 2? | **Resolvida:** 2 passos (clique seleciona; 2º clique ou `Del` remove) + undo (FR-03) | L04 |
| Q7 | Com cadastro fechado, o login pelo GitHub entra no usuário convidado por e-mail (vínculo automático de identidades)? | **Resolvida** (código do `supabase/auth` v2.198.0, ADR-0004): sim, se o e-mail do convite for um dos e-mails **verificados** da conta do GitHub; o convidado não precisa abrir o convite. Sem convite → `signup_disabled`. Sem *auth hook*. Conferir à mão no gate da L08 (Supabase local + OAuth App de dev) | L07 |
| Q8 | Onde o navegador lembra o último modo (FR-53)? | **Resolvida:** `localStorage`, chave `graph-builder:mode`, valor `local` ou `cloud`; gravado a cada troca de modo. Ao iniciar: `cloud` com sessão válida → nuvem; qualquer outro caso (sem sessão, valor ausente ou inválido, storage bloqueado) → local. É preferência do navegador, não vai para a nuvem | L08 |
| Q9 | Como o e2e entra na nuvem, se o GitHub OAuth não é automatizável? | **Resolvida:** o e2e da nuvem roda contra o Supabase local, com o build feito com as variáveis do `supabase status` (§9.3). Cada teste cria um usuário pela API admin (*service role key* local, só no processo do Playwright), entra com senha pelo `supabase-js` no Node e injeta a sessão no `localStorage` do navegador (`addInitScript`, na chave padrão do `supabase-js`) antes de abrir o app; apaga o usuário no fim. O botão "Entrar com GitHub" é conferido só até o pedido a `/auth/v1/authorize?provider=github` (interceptado com `page.route`, sem ir ao GitHub). Sem o Supabase local, esses testes são pulados com aviso | L08 |
| Q6 | Presets extras além de "Resultado WOW" e "Sem erros" | **Resolvida:** os 4 presets do FR-12, com ids e textos definidos (o `ToggleBarPreset` da L02 precisa deles) | L05 |
| Q10 | Formato dos Parâmetros e das Checagens por regra no prompt (§11) | **Aberta.** Proposta: marcador `{{nome}}` (chaves duplas; chave simples segue literal) e, por checagem, o mesmo texto que a skill do laboratório já reconhece (`Reprove se passar de N palavras.` etc.), para os prompts exportados hoje e os da v2 rodarem igual. Decidir no ADR da camada | camada dos Parâmetros do grafo |
