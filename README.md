# Graph Builder

Editor visual, 100% local, para **desenhar grafos de agentes** — quem constrói, quem julga, onde se
decide, o que se lembra — e exportá-los como:

1. um **prompt Markdown** determinístico, pronto para colar no Claude (Claude Code ou Claude
   Desktop), que descreve o fluxo, os papéis e os critérios de aprovação; e
2. um **JSON versionado** e reimportável, que é também o formato de persistência do grafo.

O app **não executa** o grafo: ele modela e gera a especificação; quem executa é o Claude. No modo
local (o padrão), nada sai do navegador — os grafos ficam no IndexedDB.

> **v2 em desenvolvimento** ([ADR-0004](docs/adr/0004-conta-e-nuvem-com-supabase.md)): um modo
> **nuvem** opcional, com login pelo GitHub e grafos guardados no Supabase, só para convidados. O
> modo local continua como está. A base (banco, RLS, adaptadores) entrou na `v1.2.0`; a interface
> (entrar, "Onde salvar", cópia entre modos) na `v1.3.0`, testada contra o Supabase local. Falta
> publicar a nuvem de produção (L09); até lá, o build do Pages é só local.

- Contrato (fonte da verdade): [`SPEC.md`](SPEC.md)
- Decisões de arquitetura: [`docs/adr/`](docs/adr)
- Mockups das telas M1–M10: [`docs/mockups/mockups.html`](docs/mockups/mockups.html)
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
  src/env.ts            # variáveis PUBLIC_SUPABASE_* do build (v2, SPEC §9.3)
  src/lib/              # canvas, paleta, inspetor, modais, estado do editor e da sessão
  src/lib/account/      # v2: seletor "Onde salvar" e botão da conta
  src/lib/cloud/        # v2: configuração e adaptadores da nuvem (carregados sob demanda)
  scripts/dev-cloud.ts  # v2: `dev:cloud`, o dev ligado ao Supabase local
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

Esse é o app da v1, só com o modo local. Para desenvolver o modo nuvem, veja
[Modo nuvem no desenvolvimento](#modo-nuvem-no-desenvolvimento).

Regras do projeto (detalhes em [`CLAUDE.md`](CLAUDE.md)):

- **SDD:** nenhuma mudança de comportamento sem atualizar o `SPEC.md` antes.
- **Git flow:** trabalho novo em `feature/…` ou `fix/…` a partir da `develop`. Cada camada termina
  com merge na `develop` e tag `vX.Y.Z`; a release vai para a `master`, que publica no GitHub
  Pages. O campo `version` dos três `package.json` acompanha a tag.
- Textos da UI em pt-BR, todos em `ui/src/lib/i18n/pt-BR.ts`; identificadores em inglês.
- Core sem exceções: `Result<T, DomainError>`. UI com runes (`$state`, `$derived`), sem stores legados.
- Imports da UI por `#lib/...` (o SvelteKit 3 removeu `$lib`).
- TypeScript **6.x** (SvelteKit 3, `svelte-check` e `typescript-eslint` ainda não aceitam o 7).

Formatação:

```bash
bun run format
```

## Modo nuvem no desenvolvimento

O modo nuvem (v2) roda contra o **Supabase local** do CLI, em Docker; nada aponta para o projeto de
produção. Os testes automáticos não precisam de GitHub (a sessão é injetada, Q9). O login real pelo
GitHub precisa de um **OAuth App de desenvolvimento** e de um **usuário convidado** no Studio.

Endereços do Supabase local: API <http://127.0.0.1:54321>, Studio <http://127.0.0.1:54323>,
Mailpit (e-mails de convite) <http://127.0.0.1:54324>.

> Use **`127.0.0.1`**, não `localhost`, em todo o fluxo de login: o Supabase local manda ao GitHub o
> callback em `127.0.0.1`, e o Safari pode forçar `https://` em `localhost` (veja
> [Problemas resolvidos](#problemas-resolvidos)).

### 1. Criar o OAuth App de desenvolvimento (uma vez por pessoa)

1. No GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Preencha:
   - **Application name:** `Graph Builder (dev)`
   - **Homepage URL:** `http://127.0.0.1:5173`
   - **Authorization callback URL:** `http://127.0.0.1:54321/auth/v1/callback`
3. **Register application**, depois **Generate a new client secret**. Guarde o *Client ID* e o
   *Client secret* fora do repositório (gerenciador de senhas).

### 2. Subir o Supabase local com o GitHub

No **mesmo terminal**, na raiz do repositório (o `db:start` lê as variáveis desta shell):

```bash
export SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=<client id> SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=<client secret>
```

```bash
bun run db:stop && bun run db:start
```

Sem as duas variáveis, o banco sobe igual e os testes passam; só o login real pelo GitHub falha. Se
o Supabase já estava no ar, o `db:stop` é necessário para ele ler as variáveis e o
`supabase/config.toml`. O `db:stop` guarda o banco (usuários e grafos continuam); o `db:reset`
apaga tudo.

### 3. Convidar um usuário no Studio

O cadastro está fechado (`enable_signup = false`): só entra quem foi cadastrado antes. Quando o
app diz "Sua conta do GitHub não tem acesso à nuvem. Peça um convite.", é este passo que falta.

1. Abra o Studio em <http://127.0.0.1:54323> → **Authentication → Users → Add user**.
2. Escolha uma das opções:
   - **Create new user:** informe o e-mail, uma senha qualquer (o login é pelo GitHub; a senha não
     é usada) e marque **Auto Confirm User**;
   - **Send invitation:** informe o e-mail; o convite cai no Mailpit e ninguém precisa abri-lo.
3. Use um e-mail **verificado na conta do GitHub** da pessoa (qualquer um deles, não só o
   principal; confira em <https://github.com/settings/emails>). No primeiro login, o Supabase liga a
   identidade do GitHub a esse usuário (Q7 no ADR-0004).

Na produção (L09), o convite é igual, no painel do projeto em <https://supabase.com/dashboard>.

### 4. Rodar o app com a nuvem

Em outro terminal (não precisa das variáveis do OAuth App):

```bash
bun run --filter ui dev:cloud
```

O script lê a URL e a chave pública do `supabase status`, passa as duas ao Vite como
`PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_KEY` (nunca por arquivo versionado) e ouve em
<http://127.0.0.1:5173/>. Abra esse endereço e clique em **Entrar com GitHub**: na volta, o topo
mostra `@seu-login` e "Onde salvar" fica em **Na nuvem**.

### 5. Ver os grafos guardados

- **No app:** **Meus grafos** com "Na nuvem" ativo ("Meus grafos — na nuvem"); o RLS mostra só os
  seus.
- **No Studio:** **Table Editor** → schema `public` → tabela `graphs`. Cada linha tem `owner_id`,
  `name`, `node_count`, `updated_at` e o grafo inteiro em `data` (o mesmo JSON do "Exportar"). O
  Studio entra como administrador e mostra os grafos de todos os usuários.
- **No SQL Editor do Studio:** a consulta versionada
  [`supabase/snippets/q-list-graphs.sql`](supabase/snippets/q-list-graphs.sql) lista os grafos do
  mais recente para o mais antigo. O Studio local lê e grava os snippets nessa pasta: a consulta
  aparece na lista do **SQL Editor** (ou é só colar o conteúdo) e um snippet salvo no Studio vira
  arquivo `.sql` ali. Dê um nome descritivo (`q-…`) e versione só consultas de leitura úteis ao
  time; o "Untitled query NNN.sql" que o Studio cria por padrão não deve ir para o git.

Apagar o usuário em **Authentication → Users** apaga também os grafos dele (`on delete cascade`). Para
conferir o acesso negado: **Sair**, apagar o usuário e entrar de novo.

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

## Segurança: CSP

A **CSP** (*Content Security Policy*) é uma lista de regras que a página entrega ao navegador:
de onde pode carregar scripts, estilos e imagens e para onde pode fazer pedidos de rede. O que
estiver fora da lista é bloqueado e aparece como violação no console.

No modo nuvem, a sessão do Supabase fica no `localStorage`: um XSS poderia roubá-la. O Svelte já
escapa todo texto; a CSP é a segunda barreira. Ela só aceita scripts do próprio app, sem
`unsafe-inline` nem `eval`, e só deixa a página falar com ela mesma e com o projeto Supabase
(NFR-05). Assim, um script injetado não roda e, se rodar, não tem para onde mandar o token.

Como o GitHub Pages não permite cabeçalhos, a CSP vai numa `<meta>` no `index.html`, gerada no
build pelo `kit.csp` do SvelteKit; as regras saem de `ui/src/lib/cloud/csp.ts` (SPEC §9.4). Em
`<meta>` não vale `frame-ancestors` (proteção contra o app dentro de um *iframe*): risco aceito. A
CSP limita o estrago de um XSS, mas não substitui o RLS, que separa os grafos de cada usuário no
banco.

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
| `base` não existe em `$app/paths` | o SvelteKit 3 removeu `base` | `resolve('/')` dá a raiz do app com o subcaminho |
| `supabase-js` no bundle mesmo sem as variáveis da nuvem | import estático: o tree-shaking não prova que a config é `null` | adaptadores da nuvem por `import()` em `ui/src/lib/cloud/services.ts` (chunk à parte) |
| Safari não abre `http://localhost:5173` com o `dev` | o Vite ouvia só em IPv6 (`[::1]`) e o Safari tentou o IPv4 | `dev:cloud` ouve em `127.0.0.1` |
| Safari troca `http://localhost` por `https://` | HSTS guardado para `localhost` por outro app de dev | usar `127.0.0.1`; para limpar, fechar o Safari e apagar `~/Library/Cookies/HSTS.plist` |
| Login do GitHub recusado no Supabase local | o auth local manda o callback `http://127.0.0.1:54321/…`, e o OAuth App tinha `localhost` | callback do OAuth App em `127.0.0.1` |

## Licença

Projeto pessoal, sem licença de uso definida.
