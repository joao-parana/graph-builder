# ADR-0001 — Stack e arquitetura do Graph Builder

- **Status:** Proposto
- **Data:** 2026-11-13
- **Contexto da spec:** SPEC.md §5, §7

## Contexto
Editor visual de grafos de agentes, 100% no navegador, que exporta prompt Markdown e JSON.
Precisa de regras de domínio testáveis isoladamente (invariantes, validação, ordem topológica,
renderização determinística) e de um canvas de nós e fios maduro.

## Decisão
1. **TypeScript strict** em todo o código (sem `any`, `noUncheckedIndexedAccess`).
2. **Monorepo Bun** (ver ADR-0002; antes: pnpm) com dois workspaces:
   - `packages/core`: `domain` → `application` → `infrastructure`, sem framework de UI/DOM.
   - `ui/` na raiz: camada de apresentação (SvelteKit 3 + Svelte 5 + `@xyflow/svelte`;
     ver ADR-0003; antes: Vite + React 19 + `@xyflow/react`).
3. **Fronteiras de camada** reforçadas por `eslint-plugin-boundaries`.
4. **Estado da UI** em runes do Svelte 5 (ver ADR-0003; antes: Zustand), mas toda mutação do grafo passa por casos de uso puros do core
   (`Graph` imutável ⇒ undo/redo = pilha de snapshots).
5. **Schema JSON** em zod com `schemaVersion` e migrações explícitas.
6. **Persistência** em IndexedDB via `idb-keyval` atrás da porta `GraphRepository`.
7. **Auto-layout** com `@dagrejs/dagre` atrás da porta `LayoutEngine`.
8. **Testes**: Vitest (core, com golden files para o prompt), Playwright (e2e).

## Alternativas consideradas
- **Canvas próprio em SVG**: controle total, mas reimplementa pan/zoom, arraste de fios e
  seleção. Rejeitado pelo custo.
- **Svelte/Vue Flow**: equivalentes, mas o ecossistema React Flow é mais maduro.
  _Revisto no ADR-0003: Svelte Flow adotado._
- **localStorage**: mais simples, mas limite de ~5 MB e API síncrona. IndexedDB fica atrás de porta, trocável.
- **elkjs** para layout: mais poderoso, porém pesado (WASM/worker). Dagre basta para DAGs E→D.

## Consequências
- O core pode ser reaproveitado num CLI (`graph-builder export grafo.json > prompt.md`) ou num
  futuro executor via Claude Agent SDK (SPEC §11).
- Svelte Flow dita parte do modelo de visão (nós/arestas próprios dele); o mapeamento
  `Graph ⇄ SvelteFlow` fica isolado em `ui/src/lib/canvas/mapping.ts` (ADR-0003).
