# HANDOFF — 2026-11-19 (sessão 9: L08 ui-account → v1.3.0)

## Estado
- **`feature/layer-08-ui-account` pronta para `v1.3.0`** (saiu da `develop` em `03646b5`; o
  primeiro commit, `efe976a`, trouxe o SPEC da L08 e os mockups M9/M10). Os três `package.json`
  estão em `1.3.0`. Falta o usuário commitar, fazer o merge na `develop` e criar a tag.
- **`develop` = `v1.2.0`** (L07 cloud-infra). **`master` = `v1.1.0`**, publicada em
  https://joao-parana.github.io/graph-builder/. Levar a `v1.3.0` para a `master` não muda o Pages:
  o workflow não passa as variáveis do Supabase, então o build continua só local até a L09.
- **Roadmap:** v1 concluída (L00–L06). v2: L07 e L08 feitas; falta a L09 (Supabase de produção,
  variáveis no GitHub Actions, OAuth App de produção, `v2.0.0`).
- **Supabase local** (Docker via Colima) está no ar, com o GitHub ligado pelas variáveis exportadas
  no terminal do usuário. `bun run db:stop` desliga e guarda o banco.

## O que a L08 entrega
- SPEC (antes do código): Q8 e Q9 resolvidas; §9.3 (variáveis `PUBLIC_SUPABASE_*`, chunk da nuvem
  por `import()`); FR-56 com o resgate do grafo não salvo; §9.2 com o login local em `127.0.0.1`;
  textos `cloud` e mockups M9/M10.
- Build: `ui/src/env.ts` (`defineEnvVars`) e `ui/src/lib/cloud/env-rules.ts` (URL http/https; recusa
  a *service role key*; as duas juntas ou nenhuma, checado no `vite.config.ts`).
- `ui/src/lib/cloud/`: `config.ts` (`cloudConfig`, `redirectTo` com `resolve('/')`) e
  `services.ts` (adaptadores, carregados por `import()`: sem as variáveis, o app não baixa o
  `supabase-js`; o chunk principal caiu de 609 kB para 232 kB).
- Estado:
  - `state/mode-preference.ts` (Q8: `graph-builder:mode` no `localStorage`, tolerante a storage
    bloqueado);
  - `state/session.svelte.ts`: `Session` (volta do login, acesso negado, sessão expirada, entrar,
    sair, trocar de modo, copiar entre modos; resgate FR-56 com `keepIn(local)` antes de ir ao
    GitHub; texto próprio sem conexão);
  - `Workspace`: `use(repo, describeFailure)`, `copyTo`, `keepIn`; `test-repo.ts` (o `MemoryRepo`
    saiu de `workspace.test.ts` para ser compartilhado).
- Core: `CloudStorageError.reason` (só o motivo, para o toast "Não foi possível salvar na nuvem:
  {motivo}").
- UI: `account/ModeSwitch.svelte` ("Onde salvar", dica sem sessão), `account/AccountButton.svelte`
  (Entrar/Entrando…, menu com Sair; avatar é a inicial, sem baixar imagem do GitHub), `TopBar`
  (título encolhe antes do "salvo"), `LibraryModal` (título por modo, cópia, menu "⋯"), `HelpModal`
  ("Conta e nuvem"), `EditorView` (sessão; nova tentativa de salvar no evento `online`).
- e2e: `ui/e2e/cloud.spec.ts` (sem sessão: authorize interceptado e acesso negado; com sessão
  injetada: salvar na nuvem, lembrar o modo, copiar, sair), `cloud-fixtures.ts` (admin API por
  `fetch`, nova tentativa em 5xx), `local-cloud.ts` (`supabase status`); o `playwright.config.ts`
  faz o build com as variáveis quando o Supabase local está no ar.
- Dev: `bun run --filter ui dev:cloud` (`ui/scripts/dev-cloud.ts`, ouve em `127.0.0.1`), launch
  `ui-dev-cloud`; `supabase/config.toml` com o GitHub ligado, `site_url` em `127.0.0.1:5173` e
  voltas em `127.0.0.1`/`localhost` nas portas 5173 e 4173.
- README: seção "Modo nuvem no desenvolvimento" (OAuth App, `db:start` com as variáveis, convite no
  Studio, `dev:cloud`, onde ver os grafos) e novas linhas em "Problemas resolvidos".

## Gate manual da Q7 (2026-11-19, Supabase local + OAuth App de dev)
- Convidado pelo Studio com um e-mail verificado no GitHub: entrou, viu `@joao-parana` e "Na nuvem";
  o grafo `MyGraph_01` (5 peças) ficou na tabela `graphs`.
- Depois de Sair e apagar o usuário: o login voltou com "Sua conta do GitHub não tem acesso à
  nuvem. Peça um convite." Q7 confirmada na prática.
- Achados no caminho:
  - o auth local manda ao GitHub o callback `http://127.0.0.1:54321/auth/v1/callback`, e o OAuth
    App tem que usar `127.0.0.1`;
  - o Vite ouvia só em `[::1]`;
  - o Safari força `https://` em `localhost` (HSTS de outro app).
  Os três estão no README e na SPEC §9.2.

## Histórico da L07 (2026-11-19)
- Q7 (convite por e-mail × login pelo GitHub com cadastro fechado): o Supabase liga a identidade do
  GitHub ao usuário convidado se o e-mail do convite for um dos e-mails **verificados** no GitHub;
  sem convite, `signup_disabled`. Sem *auth hook*. Conferência prática no gate da L08.
- `parseAuthRedirect` lê `code`/`error` na query e no fragmento; um fragmento comum (`#topo`) fica
  intacto (bug achado e corrigido nos testes).
- O aviso de testes da nuvem pulados fica num `globalSetup`: o Vitest descarta `console.warn` de
  arquivos inteiramente pulados.

## Histórico da L06
- SPEC atualizado antes do código:
  - FR-21: nome do arquivo baixado, toast "Copiado", aba JSON nunca bloqueada.
  - FR-22: arrastar, escolher ou colar; erros do `checkGraph` com `nodes[i]`/`edges[i]`; o grafo
    importado é salvo e aberto.
  - FR-30: indicador salvo/salvando/não salvo; abre o mais recente ao iniciar; `viewport` salvo
    fora do desfazer; trocar de grafo grava o pendente e zera o histórico.
  - FR-31: ordem, data ("hoje, HH:MM"), renomear na linha, Duplicar com " (cópia)", apagar o aberto.
  - FR-33: título do topo se comporta como o campo Nome do grafo.
  - Modais: `<dialog>` nativo, Esc/✕, foco volta ao botão; atalhos param com modal aberto.
  - §7.2: `DuplicateGraph` e `RenameGraph`. §9: escopo da L06 e fluxo de branches depois da v1.

### O que a L06 entrega
- Core: `duplicateGraph(ctx, graph)` e `renameGraph(ctx, repo, id, name)` em `application/library.ts`.
- `ui/src/lib/`:
  - `state/workspace.svelte.ts`: `Workspace` (autosave com debounce de 500 ms, abrir, novo,
    importar, duplicar, renomear, apagar). Usa o `IndexedDbGraphRepository`.
  - `state/editor.svelte.ts`: `ctx` público, `viewport`, `snapshot`, `load`, `clear`, `loads`.
  - `TopBar.svelte` (título inline, status, botões), `Modal.svelte` e `modals/`: `ExportModal`,
    `ImportModal`, `LibraryModal`, `ClearModal`, `HelpModal`, `modal-name.ts`.
  - `io/files.ts` (`fileName`, `downloadText`), `io/import-problems.ts`, `library/when.ts`.
  - `canvas/Canvas.svelte`: `initialViewport` + `onmoveend`; remonta a cada grafo aberto.
  - `EditorView.svelte`: paleta, canvas e inspetor só aparecem depois de abrir o grafo salvo.
- Testes:
  - unitários: `workspace`, `io` (`fileName`, `importProblems`, `formatUpdated`), `editor-fields`
    (Limpar, `load`) e core `library` (duplicar, renomear);
  - e2e `ui/e2e/io.spec.ts` (6): ida e volta export→import, prompt bloqueado, JSON inválido,
    autosave após reload, Meus grafos, Limpar + desfazer + atalhos com modal + Ajuda.
- Playwright: projetos `firefox` e `webkit` (Firefox 1572 e WebKit 2388 instalados no cache).

### Notas para os testes e2e
- WebKit não põe o foco num botão clicado (como o Safari): o teste de foco abre o modal pelo teclado.
- `clickWire` clica no `.svelte-flow__edge-interaction` (traçado largo, alvo real do clique).

### Correção: clique no fio se perdia (2026-11-19)
- Sintoma: o teste "cortar" falhava ~1 vez em 12 no Firefox/WebKit (o clique no fio não armava).
- Causa (instrumentada com eventos de ponteiro e `MutationObserver`): a cada mudança, o `Canvas`
  recria os nós sem `measured`; o Svelte Flow os trata como não medidos e **tira os fios do DOM**
  até medir de novo. Se isso cai entre `pointerdown` e `pointerup`, os alvos diferem e o navegador
  não gera `click`. O gatilho mais comum era a validação de 150 ms (FR-20) logo após ligar.
- Correção: `toFlowNodes` recebe os tamanhos já medidos (`measuredSizes`) e os repassa. Afetava
  usuários reais também (clicar num fio logo depois de editar).
- Extra (SPEC FR-03): `paneDragThreshold = 4` — tremor de até 4 px entre apertar e soltar ainda é
  clique (o padrão de 1 px transformava em arraste do canvas).
- Verificado: e2e completo 3× por navegador → 180/180; antes, 1 falha a cada ~12.

## Pendências
- **Em 2026-11-21:** remover a exceção do `minimumReleaseAge` para o xyflow. O `@xyflow/svelte`
  2.0.2 saiu em 2026-11-17 15:53 UTC e só completa os 3 dias em 2026-11-20 15:53 UTC; antes
  disso, sem a exceção, `bun install --frozen-lockfile` passa, mas qualquer resolução nova
  (`bun add`, `bun update`, lockfile refeito) falha com "blocked by minimum-release-age". Passos:
  1. apagar `minimumReleaseAgeExcludes` e o comentário dele do `bunfig.toml`;
  2. atualizar o adendo da ADR-0003 (linha "Remover a exceção a partir de 2026-11-20"; a frase de
     que o prazo só liberaria em 2026-11-20 é histórica e fica) e a linha do README em
     "Problemas resolvidos";
  3. validar com `bun install --frozen-lockfile` e com uma resolução nova numa cópia do projeto.
- **L09 (`v2.0.0`):** projeto Supabase de produção (aplicar `supabase/migrations/`, desligar "Allow
  new users to sign up", URL de volta `https://joao-parana.github.io/graph-builder/`), OAuth App de
  produção com o callback do projeto, `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_KEY` como *variables*
  do GitHub Actions no `pages.yml`, CSP por `<meta>` (ADR-0004) e gate da Q7 no projeto real.
- O e2e da nuvem roda só com o Supabase local no ar; sem ele, é pulado com aviso.
- Cobertura de branches da UI: 88,16% (componentes `.svelte` cobertos pelo e2e).
- Copiar (clipboard) não tem e2e: precisa de permissão diferente em cada navegador.

## Próximo passo
- Commit, merge na `develop` e tag `v1.3.0` (comandos entregues ao usuário).
- Em 2026-11-21, remover a exceção do xyflow (acima), numa branch própria a partir da `develop`.
- Depois, a L09.

## Gates
Comando: `bun run db:start` e depois `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; }`
(resumo da saída, 2026-11-19, `feature/layer-08-ui-account` → `v1.3.0`, Supabase local no ar)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 670 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  283 passed (283)
@graph-builder/core test: Branches     : 97.87% ( 460/470 )
ui test:       Tests  131 passed (131)
ui test: Branches     : 88.16% ( 298/338 )
ui e2e:   69 passed (59.7s)
```
Extra: `prettier --check .` → sem problemas. Numa rodada anterior, 1 e2e da nuvem falhou no WebKit
com 504 do auth local ao criar o usuário de teste (timeout de 10 s sob carga); `--repeat-each=4`
deu 36/36, e os fixtures passaram a tentar de novo em 5xx.
