# HANDOFF — 2026-11-18 (sessão 5: L03 infrastructure)

## Estado
- Camada atual: **L03 infrastructure — gate verde**, ainda **sem commit** em
  `feature/layer-03-infrastructure` (criada a partir de `develop`, que tem a L02 e a tag `v0.2.0`).
- `version` já em `0.3.0` nos três `package.json`; `bun.lock` atualizado (`bun install`).
- Tags existentes: `v0.0.1`, `v0.1.0`, `v0.2.0`.
- Nenhuma questão aberta no SPEC §12.
- SPEC atualizado antes do código:
  - §6: exemplo novo (é o golden `landing-page.md`) e 10 regras do renderer.
  - FR-22: formato do JSON e erros do `decode`.
  - NFR-03: a infraestrutura entra no gate de cobertura.
  - §7: nomes dos arquivos da infraestrutura; §7.3: versões e `fake-indexeddb` (dev).

### O que a L03 entrega
- Dependências do core: `zod` ^4.6.7, `idb-keyval` ^6.3.0, `@dagrejs/dagre` ^3.1.3; dev:
  `fake-indexeddb` ^6.2.8.
- `packages/core/src/infrastructure/`:
  - `graph-schema.ts`: schema zod v1. Nomes com a forma do INV-07/INV-09 (grafemas).
  - `json-codec.ts`: `jsonGraphCodec` (`GraphCodec`).
    - `encode`: 2 espaços, chaves em ordem fixa, `\n` no fim.
    - `decode`: erros com caminho (`nodes[2].name`) e mensagens em pt-BR (locale `ptBR` do zod);
      `schemaVersion` ≠ 1 vira erro.
  - `prompt-renderer.ts`: `renderPrompt` / `markdownPromptRenderer` (`PromptRenderer`, §6).
  - `indexeddb-repository.ts`: `IndexedDbGraphRepository`, banco `graph-builder`, store `graphs`.
  - `dagre-layout.ts`: `dagreLayoutEngine`, da esquerda para a direita, peça de 190 × 72 px,
    posições inteiras (canto superior esquerdo).
  - `system.ts`: `systemClock` e `randomIds` (`crypto.randomUUID()`).
- Testes em `test/infrastructure/` e golden files em `test/golden/`:
  - golden: `landing-page.md`, `minimal.md`, `review-loop.md`;
  - um teste confere que o exemplo do SPEC §6 é igual ao golden `landing-page`;
  - determinismo: fast-check embaralha peças e fios.
- Golden files usam `toMatchFileSnapshot`. Para regerar depois de mudar o §6:
  `bunx vitest run test/infrastructure/prompt-renderer.test.ts -u`, dentro de `packages/core`.
- Prettier: rodar sempre da raiz. O `.prettierignore` da raiz exclui `*.md`; rodado de dentro de
  `packages/core`, ele reformata os golden files.

## Pendências
- Commit da L03 (manual), merge em `develop`, tag `v0.3.0`.
- Gate e2e (`bun run --filter ui e2e`) só existe a partir da L04.
- Textos pt-BR das regras VAL e rótulos/descrições dos presets: L05 (`ui/src/lib/i18n/pt-BR.ts`).

## Próximo passo
- **L04 ui-canvas** em `feature/layer-04-ui-canvas`: canvas, paleta, peças, fios, controles de
  visão. Gate: Playwright criar/ligar/cortar/duplicar.

## Gates
Comando: `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage ; }`
(resumo da saída, 2026-11-18)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 459 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  249 passed (249)
@graph-builder/core test: Statements   : 99.86% ( 716/717 )
@graph-builder/core test: Branches     : 98.22% ( 388/395 )
@graph-builder/core test: Functions    : 100% ( 223/223 )
@graph-builder/core test: Lines        : 100% ( 547/547 )
ui test:       Tests  2 passed (2)
```
Extra: `prettier --check .` → sem problemas.
