# HANDOFF — 2026-11-19 (sessão 8: L06 ui-io)

## Estado
- Camada atual: **L06 ui-io — gate verde (e2e em Chrome, Firefox e WebKit)** em
  `feature/layer-06-ui-io`. A L06 já tem commit (`40cf603`); a correção do clique no fio (abaixo)
  ainda **não tem commit**. Falta merge em `develop`, tag `v1.0.0` e merge em `main`.
- `version` já em `1.0.0` nos três `package.json`; `bun.lock` atualizado.
- Tags existentes: `v0.0.1` … `v0.5.0`. A `v1.0.0` fecha o roadmap do SPEC §9 e vai para `main`.
- SPEC atualizado antes do código:
  - FR-21: nome do arquivo baixado, toast "Copiado", aba JSON nunca bloqueada.
  - FR-22: arrastar, escolher ou colar; erros do `checkGraph` com `nodes[i]`/`edges[i]`; o grafo
    importado é salvo e aberto.
  - FR-30: indicador salvo/salvando/não salvo; abre o mais recente ao iniciar; `viewport` salvo
    fora do desfazer; trocar de grafo grava o pendente e zera o histórico.
  - FR-31: ordem, data ("hoje, HH:MM"), renomear na linha, Duplicar com " (cópia)", apagar o aberto.
  - FR-33: título do topo se comporta como o campo Nome do grafo.
  - Modais: `<dialog>` nativo, Esc/✕, foco volta ao botão; atalhos param com modal aberto.
  - §7.2: `DuplicateGraph` e `RenameGraph`. §9: escopo da L06; `master` → `main`.

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
- Commit da correção do clique no fio, merge em `develop`, tag `v1.0.0`, merge em `main`.
- **A partir de 2026-11-20:** apagar `minimumReleaseAgeExcludes` do `bunfig.toml` e o aviso do adendo
  do ADR-0003.
- Cobertura de branches da UI: 84,16% (componentes `.svelte` cobertos pelo e2e).
- Copiar (clipboard) não tem e2e: precisa de permissão diferente em cada navegador.

## Próximo passo
- Roadmap v1 completo. Evoluções do SPEC §11 (v2+) só com SPEC novo.

## Gates
Comando: `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; }`
(resumo da saída, 2026-11-18)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 608 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  253 passed (253)
@graph-builder/core test: Branches     : 98.02% ( 397/405 )
ui test:       Tests  108 passed (108)
ui test: Branches     : 84.51% ( 191/226 )
ui e2e:   60 passed (48.3s)
```
Extra: `prettier --check .` → sem problemas; `playwright test --repeat-each=3` → 180 passed.
