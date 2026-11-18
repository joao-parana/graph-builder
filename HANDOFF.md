# HANDOFF — 2026-11-18 (sessão 3: L01 domain)

## Estado
- Camada atual: **L01 domain — gate verde**, ainda **sem commit** em `feature/layer-01-domain`
  (criada a partir de `develop`, que já tem o merge da L00).
- A tag `v0.0.1` **não existe ainda**: `git tag v0.0.1 develop` fecha a L00.
- Q1, Q2 e Q3 resolvidas no SPEC (§3.1, §3.3, VAL-05, §12). VAL-10 ganhou definição de início e
  alcance (§3.5), e o contrato de `validateGraph` (códigos sem texto; mensagens na UI).

### O que a L01 entrega (`packages/core/src/domain/`)
- `model.ts`, `ids.ts` (IDs nominais), `result.ts`, `errors.ts` (`DomainError` com código INV-xx,
  `NODE_NOT_FOUND`, `EDGE_KIND_MISMATCH`).
- `edge-kind.ts`: derivação do §3.2. `queries.ts`: consultas internas (alcance, sucessores).
- `invariants.ts`: `canAddNode` (INV-01), `canConnect` (INV-02..06, devolve o tipo do fio),
  `checkNodeName` (INV-07, nomes contados em grafemas), `isValidMaxRounds` (INV-08) e
  `checkGraph` (grafo inteiro, para o import da L03).
- `topo-sort.ts`: `topologicalOrder` estável (x, y, id); ciclos vão ao fim.
- `supervisor.ts`: `supervisorBuilders`, `judgedSources`, `returnLinks`, `hasReturnAnchor`.
- `validation.ts`: `validateGraph` (VAL-01..10) e `hasBlockingErrors`.
- Testes em `packages/core/test/domain/`: tabelas por INV/VAL e 4 propriedades com
  `fast-check` 4.10.2 (instalado com OK do usuário).
- Placeholders da L00 removidos (`test/smoke.test.ts`, constantes `*_LAYER`).

## Pendências
- Commit da L01 (manual), merge em `develop`, tag `v0.1.0`.
- Gate e2e (`bun run --filter ui e2e`) só existe a partir da L04.
- Textos pt-BR das regras VAL ficam para a L05 (`ui/src/lib/i18n/pt-BR.ts`).
- Questões abertas: Q5 (até L04), Q6 (até L05).

## Próximo passo
- **L02 application** em `feature/layer-02-application`: portas (§7.1), casos de uso (§7.2) sobre
  as funções do domínio, nome automático `"{Tipo} {n}"` (FR-01), undo/redo por snapshots (FR-08).

## Gates
Comando: `{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage ; }`
(resumo da saída, 2026-11-18)
```
@graph-builder/core typecheck: Exited with code 0
ui typecheck: COMPLETED 324 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
@graph-builder/core lint: Exited with code 0
ui lint: Exited with code 0
@graph-builder/core test:       Tests  115 passed (115)
@graph-builder/core test: Statements   : 99.68% ( 313/314 )
@graph-builder/core test: Branches     : 97.2% ( 174/179 )
@graph-builder/core test: Functions    : 100% ( 84/84 )
@graph-builder/core test: Lines        : 100% ( 229/229 )
ui test:       Tests  2 passed (2)
```
Extra: `prettier --check .` → sem problemas.
