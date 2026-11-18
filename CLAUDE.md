# CLAUDE.md — Graph Builder

## O que é
Editor visual (TypeScript) de grafos de agentes que exporta prompt Markdown + JSON para o Claude.
**Contrato:** `SPEC.md`. Mockups: `docs/mockups/mockups.html`. Decisões: `docs/adr/`.
Estado da sessão anterior: `HANDOFF.md` (efêmero, sobrescrito a cada sessão).

## Regras de trabalho
- SDD: nenhuma mudança de comportamento sem atualizar `SPEC.md` primeiro.
- Implementar **uma camada por vez**, na ordem do SPEC §9 (L00 → L06), em `feature/layer-NN-nome`,
  merge em `develop`, tag semântica ao fim da camada.
- **Versão:** o campo `"version"` de `package.json`, `packages/core/package.json` e
  `ui/package.json` acompanha a tag (sem o `v`). No último commit da branch da camada, atualizar os
  três para a versão da tag do SPEC §9 (ex.: L03 → `0.3.0`) e rodar `bun install` para o `bun.lock`
  registrar a versão dos workspaces (não instala pacote novo). O merge em `develop` e a tag vêm depois.
- Antes de editar código, listar as etapas. Se o plano tocar **mais de 3 arquivos**, parar e esperar o OK.
- Antes de `rm`, `mv` ou refatoração em massa: mostrar o diff ou rodar dry-run.
- **Não instalar dependências** (`bun add`, `bun install`) sem confirmação.
- Questões abertas do SPEC §12 devem ser resolvidas (e registradas) antes da camada indicada.
- Se o mesmo erro persistir após 2 tentativas, parar e pedir direção.
- **Commits são manuais.** Não rodar `git add`, `git commit` nem `git push`. Ao fim de uma mudança,
  entregar em texto plano os comandos `git add <arquivos>` e `git commit` (Conventional Commits)
  para o usuário executar.
  - Num worktree, gerar cada comando com `git -C <caminho absoluto do worktree>`, para o usuário
    não precisar de `cd`. Ex.: `git -C /…/.claude/worktrees/<nome> add -A`.
  - Comandos que exigem a branch `develop` (merge, tag de fim de camada) usam o caminho do
    checkout principal, porque a `develop` fica aberta nele e o Git não a abre em dois worktrees.

## Arquitetura (resumo)
- `packages/core/src/domain` — puro. Sem imports de `application`, `infrastructure`, Svelte ou DOM.
- `packages/core/src/application` — casos de uso + portas. Depende só de `domain`.
- `packages/core/src/infrastructure` — zod, IndexedDB, dagre, PromptRenderer. Implementa portas.
- `ui/` — SvelteKit 3 (SPA estático, `ssr = false`) + Svelte 5 (runes) + `@xyflow/svelte` (ADR-0003).
  Chama casos de uso; nunca muta `Graph` diretamente. Sem stores legados (`writable`) nem Zustand.
- TypeScript 6.x: o SvelteKit 3, o `svelte-check` e o `typescript-eslint` não aceitam o 7 (ADR-0003).
  Não instalar o TS 7 (nem em modo duplo) e não usar `ignoreDeprecations` no `tsconfig`.
- Toolchain (ADR-0002): Bun instala pacotes e executa scripts; Vite, Vitest e Playwright rodam no
  Node LTS. Não usar `bun test`, `bun --bun` nem APIs `Bun.*`/`bun:*` em `packages/core` ou `ui/`.

## Convenções
- UI em pt-BR (textos em `ui/src/lib/i18n/pt-BR.ts`); identificadores de código em inglês.
- Glossário UI ⇄ código: SPEC §2. Use exatamente esses nomes.
- `Result<T, DomainError>` em vez de exceções no core.
- Imports relativos com extensão `.ts`. Na UI, usar `#lib/...` (o SvelteKit 3 removeu `$lib`).
  A UI importa o core só por `@graph-builder/core` (lint de fronteiras barra o resto).
- Commits: Conventional Commits.

## Gates (terminal ZSH separado)
```zsh
{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; } 2>&1 | tee /tmp/gates.txt
```
Colar a saída de `/tmp/gates.txt` no `HANDOFF.md` ao fechar a sessão.

## Prompt de abertura de sessão
> Leia CLAUDE.md, SPEC.md e HANDOFF.md. Diga em qual camada estamos, o que falta para o gate
> dela e proponha as próximas etapas (sem editar nada ainda).
