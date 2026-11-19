# HANDOFF — 2026-11-19 (sessão 8: … v1.1.0, ADR-0004/SPEC v2, L07 cloud-infra)

## Estado
- **L07 (`feature/layer-07-cloud-infra`, versão `1.2.0`) pronta para merge**, primeira camada da
  v2 (ADR-0004 aceito: conta e grafos na nuvem com Supabase; SPEC v2 com FR-50..56, NFR-09/10,
  §7.4, L07–L09, Q7 resolvida pelo código do `supabase/auth`). A branch saiu da
  `feature/v2-cloud-auth` (ADR + SPEC v2), que entra na `develop` junto com a L07.
  - Core: portas `StorageMode`, `Account`, `AuthError`, `AuthGateway`; caso de uso `copyGraph`;
    `createCloudClient`, `SupabaseGraphRepository` (`CloudStorageError`), `SupabaseAuthGateway`
    (`parseAuthRedirect`, `toAccount`, `browserLocation`).
  - Banco: `supabase/config.toml` (`enable_signup = false`, URLs de dev/preview, GitHub desligado
    até a L08) e a migration da tabela `graphs` com RLS por dono; scripts `db:start|stop|reset`.
  - Testes: contrato do `GraphRepository` no IndexedDB e no Supabase local; RLS com dois usuários e
    sem sessão; gateway com cliente falso e real. Sem o Supabase local, pulam com aviso
    (`globalSetup` `test/infrastructure/cloud-warning.ts`).
  - Dependências: `@supabase/supabase-js` 2.119.0 (core) e `supabase` CLI 3.1.0 (raiz; o Bun já
    confia no `postinstall` dele, sem `trustedDependencies`). A UI não muda e o bundle também não
    (532 KB; o `supabase-js` sai no tree-shaking).
- **`master` = `v1.1.0`** (`e29c5aa`), publicada em https://joao-parana.github.io/graph-builder/.
  Entregou o `README.md`, o deploy no GitHub Pages (SPEC §9.2: `paths.base` via `BASE_PATH`,
  `.github/workflows/pages.yml` a cada push na `master` ou disparo manual; Source: GitHub Actions)
  e os três `package.json` em `1.1.0`. Primeiro deploy conferido: run 44511068205, build e deploy
  com sucesso; o app abre sem erros.
- **`develop`** está à frente da `master` só em documentação e comentários (sem release pendente):
  HANDOFF com o deploy conferido e a data de remoção da exceção do xyflow adiada para 2026-11-21
  (`bunfig.toml` e este arquivo). Vai para a `master` na próxima release.
- **Branches:** `master`, `develop` (aberta no checkout principal) e
  `claude/bun-homebrew-update-c2a999` (casa da worktree, parada em `973dfd4`, atrás da `develop`;
  trabalho novo sai de branch criada a partir da `develop`). Tags `v0.0.1`…`v1.1.0` no origin.
- **Roadmap v1 concluído** (L00–L06; L06 em `v1.0.0`, correção do clique no fio em `v1.0.1`).

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
- **L08 (`feature/layer-08-ui-account`):** antes, resolver Q8 (onde lembrar o modo) e Q9 (como o
  e2e entra na nuvem). O usuário cria um GitHub OAuth App de dev com callback
  `http://localhost:54321/auth/v1/callback`; o client id e o secret entram como variáveis de
  ambiente (`SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID`/`_SECRET`), nunca no repositório. O gate da L08
  confere a Q7 à mão.
- **Em 2026-11-21:** remover a exceção do `minimumReleaseAge` para o xyflow. O `@xyflow/svelte`
  2.0.2 saiu em 2026-11-17 15:53 UTC e só completa os 3 dias em 2026-11-20 15:53 UTC; antes
  disso, sem a exceção, `bun install --frozen-lockfile` passa, mas qualquer resolução nova
  (`bun add`, `bun update`, lockfile refeito) falha com "blocked by minimum-release-age". Passos:
  1. apagar `minimumReleaseAgeExcludes` e o comentário dele do `bunfig.toml`;
  2. atualizar o adendo da ADR-0003 (linha "Remover a exceção a partir de 2026-11-20"; a frase de
     que o prazo só liberaria em 2026-11-20 é histórica e fica) e a linha do README em
     "Problemas resolvidos";
  3. validar com `bun install --frozen-lockfile` e com uma resolução nova numa cópia do projeto.
- Cobertura de branches da UI: 84,51% (componentes `.svelte` cobertos pelo e2e).
- Copiar (clipboard) não tem e2e: precisa de permissão diferente em cada navegador.

## Próximo passo
- Merge da L07 em `develop` e tag `v1.2.0`; remover a exceção do xyflow em 2026-11-21 (acima); depois,
  a L08.

## Gates
Comando: `bun run db:start` e depois `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; }`
(resumo da saída, 2026-11-19, `feature/layer-07-cloud-infra`, Supabase local no ar)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 653 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  283 passed (283)
@graph-builder/core test: Branches     : 97.87% ( 460/470 )
ui test:       Tests  108 passed (108)
ui test: Branches     : 84.51% ( 191/226 )
ui e2e:   60 passed (1.2m)
```
Extra: `prettier --check .` → sem problemas; sem o Supabase local, core → 271 passed, 12 skipped,
com o aviso "[nuvem] Supabase local fora do ar".
