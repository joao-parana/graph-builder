# HANDOFF — 2026-11-24 (sessão 11: parâmetros do grafo, evoluções da barra e tutorial 01; v2.1.0)

## Estado
- **v2.2.0** Sendo publicada
- **v2.1.0** (tag anotada em `404aecb`) publicada em https://joao-parana.github.io/graph-builder/
  ("Deploy no GitHub Pages" ok em 2026-11-24 13:37). Só documentação e um teste: o app é o mesmo
  da **v2.0.0** (`37d1f77`, gate manual da L09 aprovado), agora com o tutorial 01 em
  `docs/tutorial/`. Os três `package.json` e o `bun.lock` estão em `2.1.0`. A tag não corresponde
  a uma camada do SPEC §9.
- **Roadmap:** v1 (L00–L06) e v2 (L07–L09) concluídas. Não há camada nova definida no SPEC §9.
- **`v2.1.0`** em `404aecb`. Depois dela, a `master` recebeu `82efed6` (link para a seção 5 do
  tutorial 01, editado pela web do GitHub), trazido para a `develop` com `merge master`.
- Antes disso, **`develop`**, **`master`** e `v2.1.0` estavam em `404aecb`, iguais ao `origin`. O merge da versão
  (`984e4b8`) foi feito com a `master` aberta (a mensagem do `404aecb` diz "into develop"); a
  `develop` foi alinhada por fast-forward. Histórico mantido (já enviado e com tag).
- Worktree de publicação `.claude/worktrees/graph-examples` (`feature/graph-examples`, em
  `984e4b8`): manter para os próximos tutoriais; antes de usar, `merge --ff-only develop` nele.
- **Produção:** projeto Supabase `graph-builder` (ref `oobsowknnhkwverrwgan`, us-east-2), migration
  `20261119124437_graphs.sql` aplicada, RLS ligada (`graphs_owner`), cadastro fechado
  (`disable_signup: true`), GitHub ligado com o OAuth App de produção. *Variables* do repositório:
  `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_KEY` (`sb_publishable_`). O `supabase link` da produção
  fica no checkout principal (`supabase/.temp/`), não no worktree.

## O que a sessão 11 fez
Nenhuma mudança de comportamento do app. Branch `docs/spec-parametros-do-grafo` (saiu da
`develop`, já mergeada e apagada):
- `SPEC.md` §11: item **"Parâmetros do grafo"** (`a390dcc`). Registra a convenção `{{nome}}`, que
  já funciona sem mudar o app (o renderer copia o texto como está, §6 regra 1), e a evolução:
  `Graph.parameters` (`name`, `description`, `defaultValue`), INV-10, VAL-11 (marcador sem
  declaração, erro), VAL-12 (parâmetro sem uso, alerta), seção `## Parâmetros` no prompt e
  `schemaVersion: 2` com migração v1→v2 no codec e no IndexedDB. Pede camada própria com ADR.
- `README.md`, "Exemplo de uso": subseção **"Enviar um grafo a um colega"** (`a567293`): Duplicar em
  "Meus grafos" → renomear → "Exportar para a IA" → aba JSON. O colega importa com "Abrir JSON".

Branch `docs/spec-evolucoes-da-barra` (`6f2bf54`, merge `b650a64`), a partir da análise da skill
`engenharia-de-grafos` (majinmagros/magros.ai-skills):
- `SPEC.md` §11, três itens novos depois de "Parâmetros do grafo":
  - **Checagens por regra na barra:** `SupervisorNode.checks: BarCheck[]` (`max-words`,
    `min-words`, `max-chars`, `starts-with`; valor número, texto ou `{{nome}}`), INV-11, VAL-13,
    VAL-14, bloco no inspetor, linha `Checagens por regra:` no prompt. Entra na mesma camada e na
    mesma migração (`schemaVersion: 2`) dos Parâmetros.
  - **Supervisor por nota** (`scoreMin`, `candidates`): só se os tutoriais 04/05 pedirem.
  - **Aprovação humana explícita:** só registro (peça nova, custo alto).
- `SPEC.md` §12: **Q10** (aberta), formato dos marcadores e das checagens no prompt, a decidir no
  ADR da camada.
- Já funciona hoje, sem o app: a skill `/executar-grafo` do laboratório (ver abaixo).

Branch `docs/handoff-laboratorio-master` (`4413299`, merge `c205954`): o laboratório trocou a
branch `main` por `master` (padrão do usuário) e ganhou remoto `origin`
(`github.com/joao-parana/graph-examples`).

Confirmado no código durante a sessão:
- "Abrir JSON" sempre gera um `id` novo para o grafo (`importJson`, `application/io.ts`): nunca
  sobrescreve outro grafo. Ids de peças e fios só precisam ser únicos dentro do grafo
  (`checkGraph`); na nuvem a chave é `(owner_id, id)`, com RLS por dono.
- "Apagar" existe nos dois modos de "Meus grafos" (FR-31). Com sessão, fica no menu "⋯ Mais ações"
  de cada linha (FR-54). Decisão do usuário: manter assim.

## Laboratório dos tutoriais (`graph-examples/`, repositório próprio, `master`)
Ignorado por este repositório. Feito nesta sessão (commits manuais do usuário):
- Grafo 01 ("Primeiro laço") com parâmetros `{{max_palavras}}` (Instruções do Resumidor) e
  `{{max_barra}}` (barra do Revisor), padrões 240 na linha `Parâmetros:` do Objetivo. Reexportado
  pelo app: `graphId` novo `214c6ceb-…` (as execuções antigas citam `f3e6830a-…`).
- Skill `/executar-grafo <prompt.md> [entrada] [nome=valor …]`: passo "0. Resolver parâmetros"
  (argumento → padrão → pergunta), `parametros.md` e linha `Parâmetros:` no `rodadas.md`, auditoria
  sem `{{` no pacote do crítico. Depois, com ideias da skill `engenharia-de-grafos`:
  - **Construtores isolados em ondas** (`403dfbf`): Trabalhador e Entrega rodam cada um num
    subagente novo, sem ver a barra, o Objetivo nem as Instruções de outras peças (auditoria
    `Isolamento`); peças independentes rodam em paralelo.
  - **Gates por script** (`403dfbf`): linhas mensuráveis da barra (lista fechada: palavras,
    caracteres, prefixo) são conferidas antes do crítico; gate ✗ reprova sem chamar o crítico, e o
    crítico recebe só as linhas que não são gate. Resolve o "cerca de" na contagem do crítico.
  - **"Não verificado não é aprovado"** (`142856c`, ajuste em `681873c`): o crítico marca ✓, ✗ ou
    `?`; `?` reprova. No "Se esgotar", as `Ressalvas` têm **Não cumpre** e **Não verificado**
    (inclui linhas que o crítico não julgou, `crítico não chamado`).
  - **Texto fora do bloco do construtor** (`681873c`): é registrado e auditado, mas não segue
    adiante nem muda o grafo; só o usuário decide.
- Execuções do grafo 01 com a skill nova: `2026-11-23-2003` (`max_palavras=200 max_barra=120`):
  gate reprovou a r1 (171 palavras) sem crítico, r2 aprovada (106); `2026-11-23-2132`
  (`max_barra=5`): 3 reprovações por gate e entrega com `Ressalvas` (1 Não cumpre, 2 Não
  verificado).
- Rascunho do tutorial 01, desenho, README e HANDOFF do laboratório alinhados ao grafo novo.
- Análise das alternativas e do impacto da evolução no app:
  `graph-examples/anotacoes/parametros-do-grafo.md`.
- `rascunhos/conferir.ts` (importa o core do checkout principal) passa nos 4 checks: "Abrir JSON",
  "Antes de exportar" limpo, formato canônico e prompt = `renderPrompt`.

## Publicação do tutorial 01 (sessão 11, continuação; branch `feature/graph-examples`)
Worktree `.claude/worktrees/graph-examples`, a partir da `develop` (`df84607`). Só documentação e
um teste; nenhuma mudança de comportamento do app.
- `docs/tutorial/`: `index.md` (onde rodar; **Entrar na nuvem**: pedir convite por e-mail a
  joao.parana@gmail.com, com um e-mail verificado no GitHub; a trilha dos 6 tutoriais; exemplos;
  rodar no Claude), `01-primeiro-laco.md`, `exemplos/` (JSON e Entrada de teste pública),
  `skill/executar-grafo/SKILL.md` e `imagens/01-primeiro-laco.png`.
- `packages/core/test/docs/tutorial-examples.test.ts`: para cada tutorial, "Abrir JSON" ok,
  `validateGraph` vazio, JSON canônico e o bloco da seção 5 = `renderPrompt`. Lê os arquivos por
  `?raw` (como o `SPEC.md` no `prompt-renderer.test.ts`); fora de `src/`, não muda a cobertura.
- `README.md`: seção "Tutoriais" antes de "Exemplo de uso".

## Pendências
- O e2e da nuvem roda só com o Supabase local no ar; sem ele, é pulado com aviso.
- Cobertura de branches da UI: 88,23% (componentes `.svelte` cobertos pelo e2e).
- Copiar (clipboard) não tem e2e: precisa de permissão diferente em cada navegador.
- Nunca usar `supabase config push` (levaria a config local, com `127.0.0.1`, para a produção).
- A branch `claude/graph-parameters-example-91291a` (do worktree desta sessão) ficou sem uso: pode
  ser apagada com o worktree.
- O estado `?` da skill ainda não apareceu numa execução real: no grafo 01 as linhas do crítico se
  conferem só pelo resumo. Primeiro candidato: tutorial 03 (fontes).

## Próximo passo
- Tutoriais: o 02 (Triagem com Decisão) no laboratório, no mesmo roteiro do 01; ao publicar,
  acrescentar o item na lista `TUTORIALS` do `tutorial-examples.test.ts` e tirar o "(em
  preparação)" da trilha no `docs/tutorial/index.md`. Estado e etapas em
  `graph-examples/HANDOFF-L02.md`: o HANDOFF do laboratório agora é um índice (`HANDOFF.md`) e um
  arquivo por tutorial (`HANDOFF-L01.md` … `HANDOFF-L06.md`).
- Próxima rodada de implementação: uma camada **"Parâmetros e checagens da barra"** (SPEC §11),
  só se os tutoriais 02–06 também pedirem. Começa por um ADR (resolve a Q10) e pela proposta no
  SPEC (§2, §3, §6, §9), com `schemaVersion: 2` e migração v1→v2 (`parameters: []`, `checks: []`).
  Plano toca mais de 3 arquivos: listar e esperar o OK.

## Gates
Rodados em 2026-11-24 no worktree `feature/graph-examples` (publicação do tutorial 01, Supabase
local no ar):
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: svelte-check found 0 errors and 0 warnings
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:  ✓ test/docs/tutorial-examples.test.ts (4 tests)
@graph-builder/core test:       Tests  289 passed (289)
@graph-builder/core test: Branches     : 97.89%
ui test:       Tests  135 passed (135)
ui test: Branches     : 88.23%
ui e2e:   78 passed (38.0s)
```
