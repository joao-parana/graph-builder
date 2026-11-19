# Graph Builder

Editor visual, 100% local, para **desenhar grafos de agentes** — quem constrói, quem julga, onde se
decide, o que se lembra — e exportá-los como:

1. um **prompt Markdown** determinístico, pronto para colar no Claude (Claude Code ou Claude
   Desktop), que descreve o fluxo, os papéis e os critérios de aprovação; e
2. um **JSON versionado** e reimportável, que é também o formato de persistência do grafo.

O app **não executa** o grafo: ele modela e gera a especificação; quem executa é o Claude. Nada sai
do navegador — os grafos ficam no IndexedDB local.

- Contrato (fonte da verdade): [`SPEC.md`](SPEC.md)
- Decisões de arquitetura: [`docs/adr/`](docs/adr)
- Mockups das telas M1–M8: [`docs/mockups/mockups.html`](docs/mockups/mockups.html)
- Estado da última sessão de desenvolvimento: [`HANDOFF.md`](HANDOFF.md)

## Peças

| Peça | Papel |
| --- | --- |
| **Entrada** | O insumo colado na hora de rodar. Opcional; uma por grafo. |
| **Trabalhador** | Executa uma parte do trabalho; é quem constrói. |
| **Supervisor** | Crítico cego: julga só o artefato e devolve para refazer (laço de retorno). |
| **Entrega** | Junta vários laços num artefato só. |
| **Decisão** | Escolhe **um** caminho; cada fio de saída leva uma condição escrita. |
| **Memória** | Quadro compartilhado com relações nomeadas (fio para ela = escreve; dela = consulta). |

## Arquitetura

Monorepo Bun com dois workspaces:

```
packages/core/          # TypeScript puro (Clean Architecture)
  src/domain/           # modelo, invariantes (INV-01..09), validação (VAL-01..10), ordem topológica
  src/application/      # casos de uso, portas, desfazer/refazer
  src/infrastructure/   # schema zod, codec JSON, PromptRenderer, IndexedDB (idb-keyval), dagre, Supabase
supabase/               # v2 (ADR-0004): config do Supabase local e migrations (tabela graphs + RLS)
ui/                     # SvelteKit 3 (SPA estático) + Svelte 5 (runes) + @xyflow/svelte
  src/lib/              # canvas, paleta, inspetor, modais, estado do editor
  e2e/                  # Playwright
```

A UI só fala com o core pelos casos de uso exportados por `@graph-builder/core`; um lint de
fronteiras impede `domain`/`application` de importar Svelte, DOM ou infraestrutura.

## Instalação

Pré-requisitos:

- [Bun](https://bun.sh) **1.4.4** (gerenciador de pacotes e executor de scripts — ADR-0002)
- [Node.js](https://nodejs.org) **≥ 22.17** (Vite, Vitest e Playwright rodam no Node)
- Google Chrome instalado (projeto `chrome` dos testes e2e)
- Docker (Colima, OrbStack ou Docker Desktop) para o Supabase local dos testes da nuvem (v2)

```bash
git clone git@github.com:joao-parana/graph-builder.git
```

```bash
cd graph-builder && bun install
```

O `bunfig.toml` usa linker isolado e bloqueia versões publicadas há menos de 3 dias
(`minimumReleaseAge`). Para os testes e2e em Firefox e WebKit, baixe os navegadores do Playwright
(uma vez por máquina):

```bash
cd ui && bunx playwright install firefox webkit
```

## Desenvolvimento

Servidor de desenvolvimento com recarga automática em <http://localhost:5173>:

```bash
bun run --filter ui dev
```

Regras do projeto (detalhes em [`CLAUDE.md`](CLAUDE.md)):

- **SDD:** nenhuma mudança de comportamento sem atualizar o `SPEC.md` antes.
- **Git flow:** trabalho novo em `feature/…` ou `fix/…` a partir da `develop`; a release vai para a
  `master` com tag `vX.Y.Z`; o campo `version` dos três `package.json` acompanha a tag.
- Textos da UI em pt-BR, todos em `ui/src/lib/i18n/pt-BR.ts`; identificadores em inglês.
- Core sem exceções: `Result<T, DomainError>`. UI com runes (`$state`, `$derived`), sem stores legados.
- Imports da UI por `#lib/...` (o SvelteKit 3 removeu `$lib`).
- TypeScript **6.x** (SvelteKit 3, `svelte-check` e `typescript-eslint` ainda não aceitam o 7).

Formatação:

```bash
bun run format
```

## Testes

| Nível | Ferramenta | Onde |
| --- | --- | --- |
| Unitário e propriedade | Vitest + fast-check | `packages/core/test/`, `ui/src/**/*.test.ts` |
| Golden files do prompt | Vitest | `packages/core/test/golden/*.md` |
| Ponta a ponta | Playwright (Chrome, Firefox, WebKit) | `ui/e2e/*.spec.ts` |

Gate completo (o mesmo que fecha cada camada; rode num terminal separado):

```bash
{ bun run --filter '*' typecheck && bun run --filter '*' lint && bun run --filter '*' test --coverage && bun run --filter ui e2e ; } 2>&1 | tee /tmp/gates.txt
```

A partir da L07, o gate roda com o **Supabase local** no ar (o CLI vem nas devDependencies):

```bash
bun run db:start
```

`db:stop` para os containers e `db:reset` recria o banco a partir de `supabase/migrations/`. Sem o
Supabase local, os testes da nuvem (contrato do repositório, RLS, sessão) são pulados com um aviso,
e a cobertura deixa de valer como gate. Os testes leem a URL e as chaves do `supabase status`; nada
aponta para o projeto de produção.

Partes isoladas:

```bash
bun run --filter '*' test
```

```bash
cd ui && bunx playwright test --project=chrome
```

Os golden files são regenerados com `bun run --filter @graph-builder/core test -- -u`. Rode o
Prettier sempre da raiz: é lá que o `.prettierignore` deixa os `.md` de fora; rodado de dentro de
`packages/core`, ele reformata os golden files e os testes quebram. Cobertura exigida: ≥ 90% em
`domain` + `application` + `infrastructure` (NFR-03).

## Build

```bash
bun run --filter ui build
```

Gera um SPA estático em `ui/build/` (`index.html` + `_app/`), com `index.html` como fallback de rota
(`@sveltejs/adapter-static`, `ssr = false`). Para conferir o build localmente em
<http://localhost:4173>:

```bash
bun run --filter ui preview
```

## Deploy

Não há servidor: o conteúdo de `ui/build/` é publicado como arquivos estáticos.

### GitHub Pages (oficial)

O app fica em <https://joao-parana.github.io/graph-builder/>. O workflow
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) roda a cada push na `master` (cada
release) e também pode ser disparado à mão (aba **Actions** → **Deploy no GitHub Pages** → **Run
workflow**). Ele instala as dependências, gera o build com `BASE_PATH=/graph-builder` e publica
`ui/build/`.

Configuração única no repositório: **Settings → Pages → Source: GitHub Actions**.

O subcaminho vem da variável `BASE_PATH` (`kit.paths.base` em `ui/vite.config.ts`). Sem ela, o
build assume a raiz `/`, como em dev, preview e e2e. Para conferir localmente o build do Pages em
<http://localhost:4173/graph-builder/>:

```bash
cd ui && BASE_PATH=/graph-builder bun run build && bun run preview
```

### Outra hospedagem

- **Rota de fallback:** configure a hospedagem para responder `index.html` a caminhos
  desconhecidos (no nginx, `try_files $uri /index.html;`).
- **Subcaminho:** gere o build com `BASE_PATH=/<subcaminho>` (começa com `/`, sem `/` no fim).
- **Dados por origem:** os grafos ficam no IndexedDB do navegador, ligado à origem (domínio +
  porta). Trocar de domínio começa com a lista vazia; use **Exportar → JSON** e **Abrir JSON**
  para levar grafos de um lugar para outro.

## Exemplo de uso

1. Abra o app. Ele retoma o grafo mais recente (ou cria "Meu grafo") e salva sozinho a cada
   mudança — o topo mostra **● salvo**.
2. No inspetor da direita, escreva o **Objetivo**: _Entregar a headline e o primeiro parágrafo da
   landing page do produto X._
3. Clique (ou arraste) na paleta: **Entrada**, **Trabalhador**, **Supervisor**, **Decisão**, outro
   **Trabalhador**, **Entrega** e **Memória**. Use **Arrumar** para organizar.
4. Ligue as peças arrastando da bolinha da direita de uma até a bolinha da esquerda de outra:
   Entrada → Trabalhador 1 → Supervisor 1 → Decisão 1 → (Trabalhador 2 | Entrega 1);
   Trabalhador 1 → Memória 1 → Trabalhador 2. O retorno do Supervisor aparece sozinho, tracejado.
5. Clique em cada peça e preencha as instruções. No Supervisor, escreva **a barra** ou use os
   atalhos "Preencher rápido"; na Decisão, escreva a condição de cada caminho.
6. Resolva o que o painel **Antes de exportar** apontar (clicar num item leva até a peça).
7. **Exportar para a IA** → aba **Prompt** → **Copiar prompt** e cole no Claude.

Trecho do prompt gerado (completo em
[`packages/core/test/golden/landing-page.md`](packages/core/test/golden/landing-page.md)):

```markdown
# Grafo: Landing page do produto X

## Objetivo
Entregar a headline e o primeiro parágrafo da landing page do produto X.

## Etapas
### 2. Supervisor 1 (Supervisor — crítico cego)
A barra: Reprove se a headline não citar o público.
Julga o que vem de: Trabalhador 1 · Rodadas máx.: 3 · Se esgotar: entregar o melhor com ressalvas
Se reprovar, devolve para: Trabalhador 1
Aprovado → Decisão 1

### 3. Decisão 1 (Decisão — escolha UM caminho)
- Se "há mais de uma headline aprovada" → Trabalhador 2
- Se "só uma aprovada" → Entrega 1
```

Atalhos: `Del` apaga · `⌘D` duplica · `⌘Z` / `⇧⌘Z` desfaz e refaz · clique num fio para
selecioná-lo e clique de novo (ou `Del`) para cortar · botão **?** abre a ajuda.

## Problemas resolvidos

Registro do que custou investigação, para não repetir:

| Problema | Causa | Solução |
| --- | --- | --- |
| `bun add @xyflow/svelte` recusado | `minimumReleaseAge` de 3 dias e versão recém-publicada | exceção temporária em `minimumReleaseAgeExcludes` (ADR-0003); remover a partir de 2026-11-20 |
| SvelteKit 3 não compila com TypeScript 7 | SvelteKit 3, `svelte-check` e `typescript-eslint` exigem TS 6 | fixar TS 6.x; sem `ignoreDeprecations` (ADR-0003) |
| `$lib/...` não resolve | o SvelteKit 3 removeu o alias | imports por `#lib/...` (subpath imports) |
| Erros do compilador Svelte em classes | parameter properties de TS não são aceitas; `$derived` em campo não lê o que o construtor grava | atribuir campos no construtor; getters no lugar de `$derived` em classe |
| Golden files mudavam sozinhos | Prettier rodado de `packages/core` não lê o `.prettierignore` da raiz e formatava os `.md` | rodar o Prettier sempre da raiz |
| Fios sumiam e o clique no fio se perdia (Firefox/WebKit) | nós recriados sem `measured`: o Svelte Flow tirava os fios do DOM até medir de novo | `toFlowNodes` repassa os tamanhos medidos (`measuredSizes`) |
| Clique no fio virava arraste do canvas | `paneDragThreshold` padrão de 1 px | tolerância de 4 px (FR-03) |
| Multisseleção falhava no e2e | `devices['Desktop Chrome']` usa user agent de Windows → o Svelte Flow espera Ctrl, e Ctrl+clique no macOS abre o menu de contexto | e2e usa Shift + arrastar (caixa de seleção) |
| Foco não voltava ao botão ao fechar modal (WebKit) | o Safari não foca botões clicados | teste abre o modal pelo teclado; o modal devolve o foco a quem o abriu |
| e2e intermitente após **Arrumar** | o enquadramento é animado e o teste media no meio | helpers esperam o elemento parar (`hover({ trial: true })`) |
| `sed -i ''` falhava no macOS do projeto | `sed` é alias de GNU sed (`gsed`) | sintaxe GNU (`sed -i 's/…/…/'`) |

## Licença

Projeto pessoal, sem licença de uso definida.
