# ADR-0003 — UI em Svelte 5 + SvelteKit 3 (substitui React)

- **Status:** Aceito (2026-11-18)
- **Data:** 2026-11-18
- **Contexto da spec:** SPEC.md §5 (NFR-02, NFR-05, NFR-06), §7, §7.3, §9
- **Altera:** ADR-0001, itens 2 e 4, alternativa "Svelte/Vue Flow" e consequências

## Contexto
O ADR-0001 escolheu React 19 + `@xyflow/react` + Zustand para a camada `ui/`. Ele rejeitou
Svelte Flow porque o ecossistema React Flow era mais maduro.

A decisão agora é usar a versão mais atual do Svelte e o SvelteKit compatível com ela.
Ainda não há código. A troca muda só documentos.

Versões atuais no npm em 2026-11-18:

| Pacote | Versão | Requisitos relevantes |
|---|---|---|
| `svelte` | 5.58.0 | — |
| `@sveltejs/kit` | 3.3.1 | `svelte` ^5.57.1, `vite` ^8.0.12, `typescript` ^6.0.0, `@sveltejs/vite-plugin-svelte` ^7 |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 | `vite` ^8, `svelte` ^5.46.4 |
| `@sveltejs/adapter-static` | 4.0.1 | `@sveltejs/kit` ^3 |
| `@xyflow/svelte` | 2.0.2 | `svelte` ^5.25 |
| `svelte-check` | 4.7.8 | `typescript` ^5 ou ^6 |
| `eslint-plugin-svelte` | 3.24.1 | — |
| `@testing-library/svelte` | 5.4.2 | `vitest`, `vite` |
| `vite` | 8.3.8 | — |
| `typescript` | 6.0.3 (último 6.x) | o 7.0.2 existe, mas o SvelteKit 3 não o aceita |
| `typescript-eslint` | 8.73.0 | `typescript` >=4.8.4 <6.1.0 |

### Por que TypeScript 6 e não 7
O TypeScript 7 é o compilador portado para Go (nativo). A linguagem e o sistema de tipos são
os mesmos do 6. A diferença é a velocidade. O TS 7.0 **não tem API programática estável**: o
pacote `typescript` 7.0.2 exporta só `version` e `versionMajorMinor`. Ferramentas que usam a API
do compilador (`createSourceFile`, `readConfigFile`, `parseJsonConfigFileContent`, `ts.sys`)
quebram.

- `svelte-kit sync`, `vite dev` e `vite build` quebram com TS 7
  ([sveltejs/kit#17537](https://github.com/sveltejs/kit/issues/17537)).
- `svelte-check` e `svelte2tsx` quebram com TS 7
  ([sveltejs/language-tools#3063](https://github.com/sveltejs/language-tools/issues/3063)).
  O plano dos mantenedores é migrar para a API do **TS 7.1** (beta em 2026-10-20). Sem data.
- `typescript-eslint` também não aceita TS 7 (peer `<6.1.0`). O gate de lint fica preso ao
  TS 6 mesmo sem Svelte.
- O modo duplo (`typescript@~6` + `@typescript/native@npm:typescript@7` com
  `svelte-check --tsgo`) foi rejeitado: tem bugs abertos que deixam a checagem incompleta
  sem erro (language-tools #3142, #3163, #3187).

## Decisão
1. **Svelte 5** (runes) e **SvelteKit 3** na camada `ui/`.
2. **Modo SPA estático:** `@sveltejs/adapter-static` com `fallback: 'index.html'`, e
   `export const ssr = false` em `src/routes/+layout.ts`. Não há servidor. O app roda 100% no
   navegador e funciona offline (NFR-05). Não usar `+page.server.ts`, `+server.ts` nem
   form actions.
3. **Canvas:** `@xyflow/svelte` (Svelte Flow) no lugar de `@xyflow/react`. O mapeamento
   `Graph ⇄ SvelteFlow` fica isolado em `ui/src/lib/canvas/mapping.ts`.
4. **Estado da UI:** runes do Svelte 5 (`$state`, `$derived`) em módulos `.svelte.ts` dentro de
   `ui/src/lib/state/`. Sem Zustand e sem stores legados (`writable`). Toda mutação do grafo
   continua passando pelos casos de uso puros do core (undo/redo = pilha de snapshots).
5. **Estrutura do `ui/`:** padrão SvelteKit. Uma rota (`src/routes/+page.svelte`, o editor).
   Componentes e lógica em `src/lib/` (`canvas/`, `inspector/`, `palette/`, `modals/`,
   `state/`, `i18n/`).
6. **TypeScript 6.x** em todo o monorepo (`packages/core` e `ui/`). O SvelteKit 3 exige
   `^6.0.0` e o `typescript-eslint` exige `<6.1.0`. Não instalar o TS 7, nem em modo duplo.
   - **Preparar a migração:** nenhum `tsconfig` usa `ignoreDeprecations`. O código compila no
     TS 6 sem avisos de obsolescência; assim a troca para o TS 7 não exige mudança de código.
   - **Gatilho para reavaliar:** TS 7.1 estável **e** `@sveltejs/kit`, `svelte-check` e
     `typescript-eslint` com o TS 7 no peer range. Registrar a migração em novo ADR.
7. **Typecheck e lint do `ui/`:** `svelte-check` (no lugar de `tsc --noEmit`) e
   `eslint-plugin-svelte` junto com `eslint-plugin-boundaries`.
8. **Testes do `ui/`:** Vitest + `@testing-library/svelte` para componentes. Playwright para e2e,
   sem mudança.
9. **Política de versões:** no scaffold da L00, instalar a versão mais atual de cada pacote,
   respeitando as dependências entre eles (tabela acima). As versões ficam fixas no `bun.lock`
   e as compartilhadas no catálogo do Bun (ADR-0002). Uma atualização de versão maior entra
   por PR próprio.

## Alternativas consideradas
- **Manter React 19 + React Flow:** ecossistema maior. Rejeitado: o projeto prefere Svelte, e o
  Svelte Flow 2 cobre o que o SPEC pede (nós próprios, fios, pan/zoom, seleção, minimapa).
- **Svelte 5 sem SvelteKit (Vite + `@sveltejs/vite-plugin-svelte`):** menos camadas. Rejeitado:
  o SvelteKit dá estrutura padrão, roteamento para evoluções (SPEC §11) e build estático pronto.
- **SvelteKit com SSR:** desnecessário. O app não tem servidor e não envia dados (NFR-05).

## Consequências
- **Positivas:** menos código de estado (runes no lugar de Zustand); bundle menor; estrutura de
  projeto padrão.
- **Negativas:** a toolchain fica presa ao que o SvelteKit 3 aceita (Vite 8, TypeScript 6). Exemplos
  e componentes de terceiros para Svelte Flow são menos numerosos que para React Flow.
- **Risco do TS 6 (baixo):** typecheck mais lento que no TS 7 (irrelevante no tamanho deste
  projeto); o 6.x não recebe patch desde 6.0.3 (2026-04-16), mas é só ferramenta de build e
  não vai para o navegador.
- **Riscos:** confirmar no protótipo da L04 que o Svelte Flow atende a NFR-04 (200 peças e
  400 fios a 60 fps). Se não atender, registrar aqui e reavaliar.
- O core não muda: `packages/core` continua sem dependência de framework (NFR-02).
