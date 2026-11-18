# HANDOFF — 2026-11-18 (sessão 4: L02 application)

## Estado
- Camada atual: **L02 application — gate verde**, ainda **sem commit** em
  `feature/layer-02-application` (criada a partir de `develop`, que tem a L01 e a tag `v0.1.0`).
- Tags existentes: `v0.0.1`, `v0.1.0`.
- **Nenhuma questão aberta** no SPEC §12: Q5 (FR-03, corte em 2 passos) e Q6 (FR-12, 4 presets
  com ids e textos) resolvidas nesta sessão.
- SPEC atualizado antes do código: portas `PromptRenderer`, `GraphCodec`, `GraphSummary`,
  `CodecIssue` (§7.1); casos de uso `UpdateGraph` e `OpenGraph` e os contratos da L02 (§7.2);
  INV-09 (nome do grafo).

### O que a L02 entrega
- Domínio: `labels.ts` (rótulos pt-BR dos tipos, `nextNodeName`, `DEFAULT_GRAPH_NAME`),
  `bar-presets.ts` (catálogo Q6, `addPresetLine`/`removePresetLine`), `BarPresetId` como união,
  `checkGraphName` (INV-09, também no `checkGraph`), códigos `EDGE_NOT_FOUND` e `NOT_APPLICABLE`.
- `packages/core/src/application/`:
  - `ports.ts`: portas do §7.1 e `EditContext` (`{ clock, ids }`).
  - `graph-commands.ts`: `createGraph`, `addNode`, `connectNodes`, `disconnectEdge`, `updateNode`,
    `moveNode` (snap 16 px), `duplicateNode` (+32 px), `deleteNode`, `toggleBarPreset`,
    `setEdgeCondition`, `updateGraph`, `clearGraph`, `autoLayout`. Sem mudança → mesmo objeto.
  - `io.ts`: `validate`, `exportPrompt` (devolve só os erros), `exportJson`, `importJson`
    (GraphId novo).
  - `library.ts`: `listGraphs` (mais recente primeiro), `openGraph`, `saveGraph`, `deleteGraph`.
  - `history.ts`: `startHistory`, `record`, `undo`, `redo`, limite 100.
- Testes: `test/application/` com portas falsas (`fakes.ts`), tabela por caso de uso e uma
  propriedade (comandos aleatórios mantêm o grafo válido; undo/redo exato).

## Pendências
- Commit da L02 (manual), merge em `develop`, tag `v0.2.0`.
- Gate e2e (`bun run --filter ui e2e`) só existe a partir da L04.
- Textos pt-BR das regras VAL e rótulos/descrições dos presets: L05 (`ui/src/lib/i18n/pt-BR.ts`).

## Próximo passo
- **L03 infrastructure** em `feature/layer-03-infrastructure`: schema zod (nomes com até 80
  grafemas, como o INV-07), `GraphCodec` JSON, `PromptRenderer` (golden files do §6), repositório
  IndexedDB (`idb-keyval`), `LayoutEngine` com `@dagrejs/dagre`. Instalar `zod`, `idb-keyval` e
  `@dagrejs/dagre` só após OK.

## Gates
Comando: `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage ; }`
(resumo da saída, 2026-11-18)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 331 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  176 passed (176)
@graph-builder/core test: Statements   : 99.8% ( 503/504 )
@graph-builder/core test: Branches     : 98.63% ( 290/294 )
@graph-builder/core test: Functions    : 100% ( 143/143 )
@graph-builder/core test: Lines        : 100% ( 370/370 )
ui test:       Tests  2 passed (2)
```
Extra: `prettier --check .` → sem problemas.
