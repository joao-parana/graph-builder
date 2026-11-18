# HANDOFF — 2026-11-18 (sessão 2: L00 scaffold)

## Estado
- Camada atual: **L00 scaffold — gate verde**, ainda **sem commit** em `feature/layer-00-scaffold`.
- Branches: `develop` criada a partir de `master` (`dac36c8`); `feature/layer-00-scaffold` criada
  a partir de `develop` (worktree `.claude/worktrees/bun-homebrew-update-c2a999`).
- ADR-0001, ADR-0002 e ADR-0003: **Aceitos**. SPEC §9 agora usa `master` como branch principal.

### O que a L00 entrega
- Monorepo Bun 1.4.4 (`package.json` com `workspaces` + catálogo, `bunfig.toml` com
  `linker = "isolated"` e `minimumReleaseAge = 259200`, `bun.lock`). Nenhum `postinstall` bloqueado.
- `tsconfig.base.json`: TS 6, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `allowImportingTsExtensions`; sem `ignoreDeprecations`.
- `eslint.config.js`: `strictTypeChecked`, `eslint-plugin-svelte`, fronteiras
  (domain → domain; application → domain; infrastructure → domain+application;
  ui → ui e só `@graph-builder/core`), NFR-02 (sem globais do navegador nem imports de UI/infra
  em domain/application). **Testado:** imports proibidos geram erro.
- `packages/core`: camadas com placeholders, smoke test, Vitest com limiar de 90% em
  domain + application (NFR-03).
- `ui/`: SvelteKit 3 vazio, `adapter-static` (fallback `index.html`), `ssr = false`, runes,
  i18n em `src/lib/i18n/pt-BR.ts`. `vite build` gera `ui/build/index.html`.

### Versões instaladas (mais atuais com ≥ 3 dias, por `minimumReleaseAge`)
svelte 5.57.3 · @sveltejs/kit 3.2.0 · @sveltejs/vite-plugin-svelte 7.3.1 ·
@sveltejs/adapter-static 4.0.1 · vite 8.3.8 · vitest 5.1.0 · @vitest/coverage-v8 5.1.0 ·
svelte-check 4.7.8 · typescript 6.0.3 · eslint 10.15.0 · @eslint/js 10.0.1 ·
typescript-eslint 8.72.2 · eslint-plugin-boundaries 7.4.3 · eslint-plugin-svelte 3.24.1 ·
globals 17.14.0 · prettier 3.10.1 · prettier-plugin-svelte 4.1.1 · @types/node 22.20.5.

### Descobertas do SvelteKit 3 (registradas no ADR-0003 e no CLAUDE.md)
- `svelte.config.js` não é mais aceito: config vai em `sveltekit({ ... })` no `vite.config.ts`.
- `$lib` foi removido: usar `#lib/...` (subpath imports em `ui/package.json`), com extensão `.ts`.
- `ui/tsconfig.json` estende `$app/tsconfig`, gerado por `svelte-kit sync`.

## Pendências
- **Commit e tag** da L00 (manuais): ver comandos entregues na sessão. Depois, merge em
  `develop` e tag `v0.0.1`.
- O comando completo de gates (CLAUDE.md) termina em `bun run --filter ui e2e`, que só existe a
  partir da L04 (Playwright). Até lá, rodar sem esse trecho.
- Questões abertas do SPEC §12: Q1, Q2, Q3 (até L01), Q5 (até L04), Q6 (até L05).

## Próximo passo
- Resolver Q1–Q3 e iniciar **L01 domain** em `feature/layer-01-domain` (a partir de `develop`):
  model, INV-01..08, derivação de fio, topo sort, VAL-01..10. Instalar `fast-check` (após OK).

## Gates
Comando: `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage ; }`
(resumo da saída, 2026-11-18)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 314 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
ui typecheck: Exited with code 0
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:  Test Files  1 passed (1)
@graph-builder/core test:       Tests  1 passed (1)
@graph-builder/core test: Statements   : 100% ( 3/3 )
@graph-builder/core test: Exited with code 0
ui test:  Test Files  1 passed (1)
ui test:       Tests  2 passed (2)
ui test: Exited with code 0
```
Extra: `bun run build` (ui) → `Wrote site to "build"`; `prettier --check .` → sem problemas.
