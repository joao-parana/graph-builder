# HANDOFF — 2026-11-22 (sessão 10: L09 cloud-release → v2.0.0)

## Estado
- **L09 pronta para a tag `v2.0.0`**, faltando só reconferir o item 6 do gate manual com o aviso
  modal (abaixo). Os três `package.json` estão em `2.0.0`.
- **`master`** recebeu a v2.0.0 (`304987f`) e está publicada em
  https://joao-parana.github.io/graph-builder/ com o modo nuvem ligado. A correção
  `fix/l09-aviso-sem-convite` vai junto na próxima publicação.
- **Roadmap:** v1 (L00–L06) e v2 (L07–L09) concluídas após a tag.
- **Produção:** projeto Supabase `graph-builder` (ref `oobsowknnhkwverrwgan`, us-east-2), migration
  `20261119124437_graphs.sql` aplicada, RLS ligada (`graphs_owner`), cadastro fechado
  (`disable_signup: true`), GitHub ligado com o OAuth App de produção. *Variables* do repositório:
  `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_KEY` (`sb_publishable_`). O `supabase link` da produção
  fica no checkout principal (`supabase/.temp/`), não no worktree.

## O que a L09 entrega
- CSP (SPEC §9.4): `ui/src/lib/cloud/csp.ts` (`cspDirectives`), `kit.csp` em modo `hash` no
  `vite.config.ts`; no build estático vira `<meta>` no `index.html` (no `vite preview`/`dev`, vira
  cabeçalho). `connect-src` só com `'self'` e a origem do Supabase.
- zod sem JIT (`z.config({ jitless: true })` no `graph-schema.ts`), para não testar `new Function`.
- e2e: fixture `ui/e2e/csp.ts` (falha o teste se houver `securitypolicyviolation`) usada por todos
  os specs; `csp.spec.ts` confere a meta do `build/index.html` e o cabeçalho do preview.
- `pages.yml` passa as *variables* do Supabase no build.
- README: "Segurança: CSP", "Modo nuvem em produção" e linhas novas em "Problemas resolvidos"
  (CLI 3.x em modo agente: `--output-format text`, `--yes`, link por pasta).
- chore: CLI do Supabase 3.2.0; fim da exceção de idade mínima do xyflow (ADR-0003, adendo).

## Gate manual da L09 (SPEC §9.5, 2026-11-22, produção)
- Itens 1–5 passaram: sem violação de CSP; convidado entrou, viu `@login` e "Na nuvem"; o grafo
  persistiu e apareceu em `public.graphs`; cópia nos dois sentidos; Sair manteve os grafos locais.
- Item 6 (conta sem convite): o app ficou no modo local, mas o toast de 3 s sumia antes de o
  usuário ler. A volta real da produção é
  `?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance`
  (na query, com o código: Q7 confirmada também em produção).
- Correção (`fix/l09-aviso-sem-convite`, SPEC FR-51 "Aviso de login"): a mensagem da volta do login
  (sem convite ou falha) abre num `alertdialog` ("Entrar com GitHub", botão "Entendi") que só fecha
  pelo usuário; a descrição "Signups not allowed" sem o código também conta como sem convite.
  Achado no e2e: o atalho de Esc do editor fazia `preventDefault` com o aviso aberto e o impedia de
  fechar; os atalhos agora param com o aviso aberto.
- **Falta:** depois do deploy da correção, repetir o item 6 e ver o aviso ficar até "Entendi".

## Pendências
- Tag `v2.0.0` depois de reconferir o item 6.
- O e2e da nuvem roda só com o Supabase local no ar; sem ele, é pulado com aviso.
- Cobertura de branches da UI: 88,23% (componentes `.svelte` cobertos pelo e2e).
- Copiar (clipboard) não tem e2e: precisa de permissão diferente em cada navegador.
- Nunca usar `supabase config push` (levaria a config local, com `127.0.0.1`, para a produção).

## Próximo passo
- Commit da correção, merge na `develop` e na `master` (deploy), item 6 de novo, tag `v2.0.0`.

## Gates
Comando: `bun run db:start` e depois `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; }`
(resumo da saída, 2026-11-22, `fix/l09-aviso-sem-convite`, Supabase local no ar)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 675 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  285 passed (285)
@graph-builder/core test: Branches     : 97.89% ( 464/474 )
ui test:       Tests  135 passed (135)
ui test: Branches     : 88.23% ( 300/340 )
ui e2e:   78 passed (1.1m)
```
Extra: `prettier --check` nos arquivos alterados → sem problemas.
