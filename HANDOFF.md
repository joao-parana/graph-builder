# HANDOFF — 2026-11-18 (sessão 6: L04 ui-canvas)

## Estado
- Camada atual: **L04 ui-canvas — gate verde (com e2e)**, ainda **sem commit** em
  `feature/layer-04-ui-canvas` (criada a partir de `develop`, que tem a L03 e a tag `v0.3.0`).
- `version` já em `0.4.0` nos três `package.json`; `bun.lock` atualizado.
- Tags existentes: `v0.0.1`, `v0.1.0`, `v0.2.0`, `v0.3.0`.
- SPEC atualizado antes do código:
  - FR-01: posição do clique (centro visível, grade, cascata de +32 px) e seleção da peça nova.
  - FR-06: snap ligado por padrão, botão **Grade**.
  - FR-07: zoom em passos de 10 pontos; Arrumar desfazível.
  - FR-08: atalhos não agem em campo de texto; comando recusado vira toast.
  - FR-09 (novo): desenho dos fios (cheio, Memória pontilhado, retorno tracejado vermelho).
  - §9: escopo da L04 e e2e no Google Chrome instalado (`channel: 'chrome'`).
- ADR-0003, adendo: exceção de idade mínima no `bunfig.toml` para `@xyflow/svelte` e
  `@xyflow/system`. **Remover a partir de 2026-11-20** (ver Pendências).

### O que a L04 entrega
- Dependências do `ui/`: `@xyflow/svelte` ^2.0.2; dev: `@playwright/test` ^1.65.1.
  Script novo: `e2e` (`playwright test`, servidor `vite build` + `vite preview` na porta 4173).
- `ui/src/lib/`:
  - `state/editor.svelte.ts`: classe `Editor` (runes) sobre os casos de uso do core.
    - Mantém o histórico, a seleção, o fio armado para corte, o snap, o Foco e o toast.
    - Ações com várias peças entram como um passo só de desfazer.
  - `state/shortcuts.ts`: Del/Backspace, Esc, ⌘/Ctrl+D, ⌘/Ctrl+Z, ⌘/Ctrl+Shift+Z.
  - `canvas/mapping.ts`: `Graph` → nós e fios do Svelte Flow, incluindo os retornos derivados.
    `isValidWire` usa o `canConnect` do domínio.
  - `canvas/Canvas.svelte`, `canvas/PieceNode.svelte`, `canvas/ZoomBar.svelte`, `canvas/zoom.ts`.
    - O Svelte Flow só desenha; o fio novo entra via `onbeforeconnect` → `Editor.connect`.
    - Os fios não são selecionáveis pelo Svelte Flow: o corte em 2 passos é do `Editor`.
  - `palette/Palette.svelte` e `palette/drag.ts`: clique e arrastar (FR-01).
  - `EditorView.svelte`, `Toast.svelte` e `theme.css` (cores do M1).
  - `i18n/pt-BR.ts`: textos da paleta, do canvas e motivos dos erros do domínio.
- Testes:
  - unitários (Vitest): `editor`, `mapping`, `shortcuts`, `zoom` e `drag`;
  - e2e (`ui/e2e/canvas.spec.ts`, 7 testes): criar, ligar, cortar, duplicar e controles de visão.
- `.claude/launch.json` (local, fora do commit): servidor `ui-dev` na porta 5173 para o preview.

## Pendências
- Commit da L04 (manual), merge em `develop`, tag `v0.4.0`.
- **A partir de 2026-11-20:** apagar a linha `minimumReleaseAgeExcludes` do `bunfig.toml` e o aviso
  do adendo do ADR-0003 (o `@xyflow/svelte` 2.0.2 já terá 3 dias).
- `Graph.viewport` ainda não acompanha o pan/zoom: entra com o salvamento automático (L06).
- e2e em Firefox e Safari: L06.

## Próximo passo
- **L05 ui-panels** em `feature/layer-05-ui-panels`: inspetores M2–M5 (FR-10..15) e painel
  "Antes de exportar" (FR-20). Gate: Playwright de validação ao vivo.

## Gates
Comando: `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; }`
(resumo da saída, 2026-11-18)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 580 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  249 passed (249)
@graph-builder/core test: Branches     : 98.22% ( 388/395 )
ui test:       Tests  54 passed (54)
ui test: Branches     : 96.84% ( 92/95 )
ui e2e:   7 passed (12.8s)
```
Extra: `prettier --check .` → sem problemas.
