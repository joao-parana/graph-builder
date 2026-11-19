# HANDOFF — 2026-11-18 (sessão 7: L05 ui-panels)

## Estado
- Camada atual: **L05 ui-panels — gate verde (com e2e)**, ainda **sem commit** em
  `feature/layer-05-ui-panels` (criada a partir de `develop`, que tem a L04 e a tag `v0.4.0`).
- `version` já em `0.5.0` nos três `package.json`; `bun.lock` atualizado.
- Tags existentes: `v0.0.1`, `v0.1.0`, `v0.2.0`, `v0.3.0`, `v0.4.0`.
- SPEC atualizado antes do código:
  - FR-08: edição de um campo = um passo de desfazer, fechado ao sair do campo (`amend`).
  - FR-10: resumo com "N fios · M laços de retorno"; várias peças → "N peças selecionadas" + Apagar;
    valor recusado fica no rascunho com erro embaixo e volta ao sair.
  - FR-11: linhas de ligação com os rótulos da regra 8 (§6), clicáveis para revelar a peça.
  - FR-13: condição vazia em vermelho com aviso. FR-14: chips com ×, "+ adicionar" com Enter ou vírgula.
  - FR-20: clique no item seleciona a peça; VAL-01 foca o Objetivo; peças citadas com contorno amarelo.
  - §7.2 documenta `amend`; §9 ganhou a nota de escopo da L05.

### O que a L05 entrega
- Core: `amend(history, next)` em `application/history.ts` (substitui o presente sem novo passo).
- `ui/src/lib/`:
  - `state/editor.svelte.ts`: `editNode`, `editGraph`, `editCondition` (agrupados por campo),
    `endEdit`, `updateNode` e `togglePreset` (um passo por clique).
  - `inspector/`: `Inspector`, `GraphPanel`, `NodePanel`, `Field`, `Links`, `connections.ts`
    (`connectionsOf`, `summaryOf`) e `field-error.ts`.
  - `validation/`: `PreExportPanel.svelte` e `messages.ts` (5 itens visíveis + "+ N outros").
  - `canvas/`: `PieceData.flagged` → contorno amarelo; validação com debounce de 150 ms no `EditorView`.
  - `i18n/pt-BR.ts`: textos do inspetor, presets e mensagens VAL-01..10.
- Testes:
  - unitários: `editor-fields`, `connections`, `messages` (+ `fieldError`) e `mapping` (flagged);
  - e2e `ui/e2e/panels.spec.ts` (7 testes): objetivo ao vivo, item → peça, condição da Decisão,
    presets, nome repetido, desfazer por campo, várias peças.
- e2e do canvas mais robusto: `center` espera o elemento parar (o Arrumar anima o enquadramento);
  `clickWire` espera o fio ficar visível. Antes havia falhas intermitentes com workers em paralelo.

### Notas para os testes e2e
- `devices['Desktop Chrome']` usa user agent de Windows: o Svelte Flow espera **Ctrl** para
  multisseleção, e Ctrl+clique no macOS abre o menu de contexto (limpa a seleção). O teste usa
  Shift + arrastar (caixa de seleção). No app real, ⌘+clique funciona (verificado no navegador).

## Pendências
- Commit da L05 (manual), merge em `develop`, tag `v0.5.0`.
- **A partir de 2026-11-20:** apagar a linha `minimumReleaseAgeExcludes` do `bunfig.toml` e o aviso
  do adendo do ADR-0003.
- O grafo vive só em memória: um reload (ou HMR completo) zera tudo. Salvamento automático na L06.
- `Graph.viewport` ainda não acompanha o pan/zoom (L06). e2e em Firefox e Safari: L06.
- Cobertura de branches da UI caiu para 86,3% (componentes `.svelte` cobertos pelo e2e, não pelo Vitest).

## Próximo passo
- **L06** em `feature/layer-06-...` conforme SPEC §9 (exportação, salvamento automático, navegadores).

## Gates
Comando: `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; }`
(resumo da saída, 2026-11-18)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 593 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  251 passed (251)
@graph-builder/core test: Branches     : 98.23% ( 390/397 )
ui test:       Tests  90 passed (90)
ui test: Branches     : 86.3% ( 126/146 )
ui e2e:   14 passed (16.5s)
```
Extra: `prettier --check .` → sem problemas; e2e com `--repeat-each=2` 3× seguidas → 28/28.
