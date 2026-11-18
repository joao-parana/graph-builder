# ADR-0002 — Bun como gerenciador de pacotes (substitui pnpm)

- **Status:** Aceito (2026-11-18)
- **Data:** 2026-11-18
- **Contexto da spec:** SPEC.md §7, §9, §9.1, §12 (Q4)
- **Altera:** ADR-0001, item 2 ("Monorepo pnpm")

## Contexto
O ADR-0001 escolheu um monorepo pnpm. A questão Q4 do SPEC (pnpm ou bun) continua aberta
e deve ser resolvida antes da camada L00.

Ainda não há código, `package.json` nem lockfile. A migração não tem custo de conversão:
ela muda só documentos (SPEC, ADR-0001, CLAUDE.md).

O projeto precisa de:
- workspaces (`packages/core` e `ui/`);
- dependências estritas: um pacote só importa o que declara (apoia NFR-02);
- instalação reproduzível em CI;
- Vite, Vitest e Playwright (ADR-0001, item 8).

O Bun 1.3 tem gerenciador de pacotes com workspaces, catálogos, `bun.lock` em texto e
modo de instalação isolado (links simbólicos, como o pnpm).

## Decisão
1. **Bun ≥ 1.3** é o gerenciador de pacotes e o executor de scripts do monorepo.
   Fixar a versão em `package.json` → `"packageManager": "bun@1.3.x"`.
2. **Workspaces** no `package.json` da raiz:
   ```json
   "workspaces": {
     "packages": ["packages/*", "ui"],
     "catalog": { "typescript": "…", "vitest": "…", "zod": "…" }
   }
   ```
   Dependências compartilhadas usam `"catalog:"` nos workspaces.
3. **Instalação isolada** em `bunfig.toml`:
   ```toml
   [install]
   linker = "isolated"          # node_modules estrito, como o pnpm
   minimumReleaseAge = 259200   # segundos (3 dias): bloqueia versões recém-publicadas
   ```
4. **Lockfile:** `bun.lock` é versionado. CI usa `bun install --frozen-lockfile`.
5. **Scripts de instalação:** dependências não executam `postinstall` por padrão.
   Cada exceção entra em `trustedDependencies`, com justificativa no PR.
6. **Escopo do Bun:** só gerenciador de pacotes e executor de scripts.
   - Vite, Vitest e Playwright continuam como estão e rodam no **Node LTS**.
     Não usar `bun --bun` nem trocar Vitest por `bun test`.
   - Código de `packages/core` e `ui/` **não** usa APIs `Bun.*` nem `bun:*`. Ele roda no
     navegador (NFR-05).
   - Scripts de ferramenta (fora de `src/`) podem usar APIs do Bun.
7. **Gates** (substitui SPEC §9.1):
   ```zsh
   { bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; } 2>&1 | tee /tmp/gates.txt
   ```

### Equivalência de comandos
| pnpm | Bun |
|---|---|
| `pnpm install` | `bun install` |
| `pnpm add <pkg>` / `pnpm add -D <pkg>` | `bun add <pkg>` / `bun add -d <pkg>` |
| `pnpm -r <script>` | `bun run --filter '*' <script>` |
| `pnpm --filter ui <script>` | `bun run --filter ui <script>` |
| `pnpm dlx <bin>` | `bunx <bin>` |
| `pnpm install --frozen-lockfile` | `bun install --frozen-lockfile` |

## Alternativas consideradas
- **Manter pnpm:** maduro, filtros de grafo ricos (`--filter ...^`). Rejeitado: o Bun cobre
  as necessidades do projeto, instala mais rápido e já está na máquina de desenvolvimento.
- **Bun completo** (runtime + `bun test` + `bun build`): uma ferramenta só. Rejeitado:
  `bun test` não integra com a config do Vite, e cobertura, ambiente DOM e Playwright
  ficariam diferentes do ADR-0001. Reavaliar depois da v1.
- **npm / Yarn:** sem ganho sobre pnpm ou Bun para este caso.

## Consequências
- **Positivas:** instalação mais rápida; uma ferramenta para instalar e rodar scripts;
  `bun.lock` legível em diff; postinstall bloqueado por padrão; proteção contra versões
  recém-publicadas.
- **Negativas:** a máquina e a CI precisam de **dois** runtimes (Bun e Node LTS). O
  `--filter` do Bun seleciona por nome ou caminho; não há seletores de grafo como no pnpm.
- **Riscos:** verificar suporte do bot de atualização de dependências ao `bun.lock` antes
  de ativá-lo. Se o modo isolado quebrar alguma ferramenta, registrar a exceção aqui.

## Mudanças aplicadas (SDD — antes do L00, em 2026-11-18)
1. SPEC §7: "monorepo pnpm" → "monorepo Bun (ADR-0002)".
2. SPEC §9, linha L00: entregável e gate com comandos Bun.
3. SPEC §9.1: novo comando de gates (item 7).
4. SPEC §12, Q4: marcar como resolvida → Bun (ADR-0002).
5. ADR-0001, item 2: "Monorepo pnpm" → "Monorepo Bun (ver ADR-0002)".
6. CLAUDE.md: regra de dependências (`bun add`, `bun install`) e comando de gates.
