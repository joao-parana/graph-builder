# HANDOFF — 2026-11-18 (sessão 8: L06 ui-io)

## Estado
- Camada atual: **L06 ui-io — gate verde (e2e em Chrome, Firefox e WebKit)**, ainda **sem commit**
  em `feature/layer-06-ui-io` (criada a partir de `develop`, que tem a L05 e a tag `v0.5.0`).
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
- **Intermitente:** o teste "cortar" do `canvas.spec.ts` falhou ~1 vez em 12 repetições no Firefox
  e no WebKit (o 1º clique às vezes não arma o fio). O gate completo passou. Suspeita: um
  `onselectionchange` atrasado do Svelte Flow chama `Editor.select([peça])`, que desarma o fio.
  Não investigado a fundo.

## Pendências
- Commit da L06 (manual), merge em `develop`, tag `v1.0.0`, merge em `main`.
- **A partir de 2026-11-20:** apagar `minimumReleaseAgeExcludes` do `bunfig.toml` e o aviso do adendo
  do ADR-0003.
- Investigar a intermitência do "cortar" no Firefox/WebKit (ver acima).
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
@graph-builder/core test: Branches     : 98.27% ( 398/405 )
ui test:       Tests  107 passed (107)
ui test: Branches     : 84.16% ( 186/221 )
ui e2e:   60 passed (1.1m)
```
Extra: `prettier --check .` → sem problemas.
