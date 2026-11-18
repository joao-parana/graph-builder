# CLAUDE.md — Graph Builder

## O que é
Editor visual (TypeScript) de grafos de agentes que exporta prompt Markdown + JSON para o Claude.
**Contrato:** `SPEC.md`. Mockups: `docs/mockups/mockups.html`. Decisões: `docs/adr/`.
Estado da sessão anterior: `HANDOFF.md` (efêmero, sobrescrito a cada sessão).

## Regras de trabalho
- SDD: nenhuma mudança de comportamento sem atualizar `SPEC.md` primeiro.
- Implementar **uma camada por vez**, na ordem do SPEC §9 (L00 → L06), em `feature/layer-NN-nome`,
  merge em `develop`, tag semântica ao fim da camada.
- Antes de editar código, listar as etapas. Se o plano tocar **mais de 3 arquivos**, parar e esperar o OK.
- Antes de `rm`, `mv` ou refatoração em massa: mostrar o diff ou rodar dry-run.
- **Não instalar dependências** (`bun add`, `bun install`) sem confirmação.
- Questões abertas do SPEC §12 devem ser resolvidas (e registradas) antes da camada indicada.
- Se o mesmo erro persistir após 2 tentativas, parar e pedir direção.
- **Commits são manuais.** Não rodar `git add`, `git commit` nem `git push`. Ao fim de uma mudança,
  entregar em texto plano os comandos `git add <arquivos>` e `git commit` (Conventional Commits)
  para o usuário executar.

## Arquitetura (resumo)
- `packages/core/src/domain` — puro. Sem imports de `application`, `infrastructure`, React ou DOM.
- `packages/core/src/application` — casos de uso + portas. Depende só de `domain`.
- `packages/core/src/infrastructure` — zod, IndexedDB, dagre, PromptRenderer. Implementa portas.
- `ui/` — React + @xyflow/react + Zustand. Chama casos de uso; nunca muta `Graph` diretamente.
- Toolchain (ADR-0002): Bun instala pacotes e executa scripts; Vite, Vitest e Playwright rodam no
  Node LTS. Não usar `bun test`, `bun --bun` nem APIs `Bun.*`/`bun:*` em `packages/core` ou `ui/`.

## Convenções
- UI em pt-BR (textos em `ui/src/i18n/pt-BR.ts`); identificadores de código em inglês.
- Glossário UI ⇄ código: SPEC §2. Use exatamente esses nomes.
- `Result<T, DomainError>` em vez de exceções no core.
- Commits: Conventional Commits.

## Gates (terminal ZSH separado)
```zsh
{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; } 2>&1 | tee /tmp/gates.txt
```
Colar a saída de `/tmp/gates.txt` no `HANDOFF.md` ao fechar a sessão.

## Prompt de abertura de sessão
> Leia CLAUDE.md, SPEC.md e HANDOFF.md. Diga em qual camada estamos, o que falta para o gate
> dela e proponha as próximas etapas (sem editar nada ainda).
