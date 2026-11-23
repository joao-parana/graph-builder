# HANDOFF — 2026-11-23 (sessão 11: parâmetros do grafo, só documentação)

## Estado
- **v2.0.0** (tag em `37d1f77`) segue publicada em https://joao-parana.github.io/graph-builder/ com
  o modo nuvem ligado. Gate manual da L09 aprovado (item 6 repetido após o deploy da correção
  `fix/l09-aviso-sem-convite`). Os três `package.json` estão em `2.0.0`.
- **Roadmap:** v1 (L00–L06) e v2 (L07–L09) concluídas. Não há camada nova definida no SPEC §9.
- **`develop`** em `89db497`, igual ao `origin/develop`. A `master` não recebeu os commits desta
  sessão (só documentação; sem release).
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

Confirmado no código durante a sessão:
- "Abrir JSON" sempre gera um `id` novo para o grafo (`importJson`, `application/io.ts`): nunca
  sobrescreve outro grafo. Ids de peças e fios só precisam ser únicos dentro do grafo
  (`checkGraph`); na nuvem a chave é `(owner_id, id)`, com RLS por dono.
- "Apagar" existe nos dois modos de "Meus grafos" (FR-31). Com sessão, fica no menu "⋯ Mais ações"
  de cada linha (FR-54). Decisão do usuário: manter assim.

## Laboratório dos tutoriais (`graph-examples/`, repositório próprio, `main`)
Ignorado por este repositório. Feito nesta sessão (commits manuais do usuário):
- Grafo 01 ("Primeiro laço") com parâmetros `{{max_palavras}}` (Instruções do Resumidor) e
  `{{max_barra}}` (barra do Revisor), padrões 240 na linha `Parâmetros:` do Objetivo. Reexportado
  pelo app: `graphId` novo `214c6ceb-…` (as execuções antigas citam `f3e6830a-…`).
- Skill `/executar-grafo <prompt.md> [entrada] [nome=valor …]`: passo "0. Resolver parâmetros"
  (argumento → padrão → pergunta), `parametros.md` e linha `Parâmetros:` no `rodadas.md`, auditoria
  sem `{{` no pacote do crítico. Já rodada com reprovação e recuperação (`max_palavras=200
  max_barra=120`).
- Rascunho do tutorial 01, desenho, README e HANDOFF do laboratório alinhados ao grafo novo.
- Análise das alternativas e do impacto da evolução no app:
  `graph-examples/anotacoes/parametros-do-grafo.md`.
- `rascunhos/conferir.ts` (importa o core do checkout principal) passa nos 4 checks: "Abrir JSON",
  "Antes de exportar" limpo, formato canônico e prompt = `renderPrompt`.

## Pendências
- O e2e da nuvem roda só com o Supabase local no ar; sem ele, é pulado com aviso.
- Cobertura de branches da UI: 88,23% (componentes `.svelte` cobertos pelo e2e).
- Copiar (clipboard) não tem e2e: precisa de permissão diferente em cada navegador.
- Nunca usar `supabase config push` (levaria a config local, com `127.0.0.1`, para a produção).
- A branch `claude/graph-parameters-example-91291a` (do worktree desta sessão) ficou sem uso: pode
  ser apagada com o worktree.

## Próximo passo
- Tutoriais: fechar o tutorial 01 no laboratório e publicar em `docs/tutorial/` pela branch
  `feature/graph-examples` (plano no `HANDOFF.md` do laboratório).
- Parâmetros declarados no grafo (SPEC §11): só se os tutoriais 02–06 também pedirem parâmetros.
  Começa pela proposta no SPEC (§2, §3, §6, §9, Q10 em §12) e por um ADR, numa camada própria.

## Gates
Não rodados nesta sessão: só `SPEC.md`, `README.md` e `HANDOFF.md` mudaram. Última rodada
(2026-11-22, `fix/l09-aviso-sem-convite`, Supabase local no ar):
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 675 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  285 passed (285)
@graph-builder/core test: Branches     : 97.89% ( 464/474 )
ui test:       Tests  135 passed (135)
ui test: Branches     : 88.23% ( 300/340 )
ui e2e:   78 passed (1.1m)
```
