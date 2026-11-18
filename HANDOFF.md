# HANDOFF — 2026-11-18 (sessão 1: decisões de toolchain e UI)

## Estado
- Camada atual: **antes da L00**. Nenhum código ainda.
- Branch: `claude/bun-homebrew-update-c2a999` (worktree). Commits desta sessão:
  - `0cc7e5f` — ADR-0002: Bun como gerenciador de pacotes e executor de scripts.
  - `e6c2082` — ADR-0003: Svelte 5 + SvelteKit 3 na UI; TypeScript 6.x.
- Decisões (detalhes nos ADRs):
  - **ADR-0002 (Aceito):** Bun ≥ 1.3, `linker = "isolated"`, `bun.lock` versionado,
    `minimumReleaseAge` de 3 dias, `trustedDependencies` explícito. Vite, Vitest e Playwright rodam
    no Node LTS. Proibido `bun test`, `bun --bun` e APIs `Bun.*`/`bun:*` em `packages/core` e `ui/`.
  - **ADR-0003 (Aceito):** Svelte 5 (runes) + SvelteKit 3 em SPA estático (`adapter-static`,
    `ssr = false`) + `@xyflow/svelte`. Sem Zustand nem stores legados. **TypeScript 6.x**:
    SvelteKit 3, `svelte-check` e `typescript-eslint` não aceitam o TS 7. Proibido
    `ignoreDeprecations`.
  - **ADR-0001 (Aceito em 2026-11-18):** com as alterações dos ADR-0002 e ADR-0003.
- SPEC: Q4 resolvida (Bun). §7, §7.3, §9, §9.1 e NFR-01/02/06 atualizados.
- CLAUDE.md: nova regra — **commits são manuais**; o agente entrega `git add`/`git commit` em texto.

## Pendências
- **Branches:** a principal local chama-se `master`, mas SPEC §9 fala em `main` e `develop`.
  `develop` não existe. Decidir o nome e criar `develop` antes do merge desta branch.
- Confirmar a versão do Bun instalada (`bun --version`, precisa ser ≥ 1.3).
- Questões abertas do SPEC §12: Q1, Q2, Q3 (até L01), Q5 (até L04), Q6 (até L05).

## Próximo passo
1. Merge de `claude/bun-homebrew-update-c2a999` em `develop` (feito pelo usuário).
2. Iniciar **L00 scaffold** em `feature/layer-00-scaffold`:
   - monorepo Bun (`package.json` com `workspaces` + catálogo, `bunfig.toml`);
   - `packages/core` (TS 6 strict) e `ui/` (SvelteKit 3 vazio, `adapter-static`, `ssr = false`);
   - ESLint boundaries + `eslint-plugin-svelte`, Vitest, `svelte-check`;
   - consultar versões atuais no npm antes de instalar (falta conferir `prettier-plugin-svelte`);
   - **instalação só após OK do usuário** (lista de pacotes e versões primeiro).
3. Validar no scaffold o comando de gates com `bun run --filter` (ainda não testado).

## Gates
_(ainda não há código — nada a rodar)_
