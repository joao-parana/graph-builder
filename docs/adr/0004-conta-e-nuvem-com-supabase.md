# ADR-0004 — Conta e grafos na nuvem com Supabase (v2)

- **Status:** Proposto (2026-11-19)
- **Data:** 2026-11-19
- **Contexto da spec:** SPEC.md §1, §4 (FR-50..56), §5 (NFR-05, NFR-09, NFR-10), §7, §7.4, §9, §12
  (Q7–Q9)
- **Altera:** SPEC §1.2 (contas e nuvem saem do "fora de escopo"); ADR-0003, alternativa "SvelteKit
  com SSR" (o app continua sem servidor próprio, mas passa a enviar dados no modo nuvem)

## Contexto
A v1 é 100% local: os grafos ficam no IndexedDB do navegador (FR-30) e nenhum dado sai dele
(NFR-05). O app é publicado como SPA estático no GitHub Pages (SPEC §9.2), sem servidor próprio.

Na v2, queremos:
- **grafos na nuvem por usuário**, para abrir os mesmos grafos em outro navegador ou máquina;
- **restringir quem usa a nuvem** a pessoas convidadas.

Restrições:
- **O GitHub Pages só serve arquivos estáticos.** Não roda código no servidor, não controla quem
  acessa o site e não deixa configurar cabeçalhos HTTP. O repositório é público, então o bundle
  também é.
- **Autorização só vale fora do navegador.** Qualquer regra no JS pode ser contornada no DevTools.
  Quem decide o que cada usuário lê e grava tem que ser o servidor de dados.
- **O core não pode depender de fornecedor.** A porta `GraphRepository` (SPEC §7.1) já isola a
  persistência; o novo armazenamento deve entrar como outro adaptador dela.

## Decisão
1. **Supabase** fornece autenticação (Supabase Auth) e armazenamento (Postgres). O front continua
   no GitHub Pages; não há servidor nosso.
2. **Dois modos** (SPEC §2):
   - **Local (sem login):** exatamente a v1. IndexedDB, uso offline, aberto a qualquer pessoa. A
     NFR-05 continua valendo para ele.
   - **Nuvem (com login):** grafos na tabela `graphs` do Supabase, só para convidados.
   - O usuário escolhe o modo; os dois convivem. **Não há sincronização automática:** grafos passam
     de um modo para o outro por cópia explícita (FR-53), com `GraphId` novo, como no `ImportJson`.
     Assim não há conflito de versões para resolver.
3. **Login com GitHub (OAuth)** pelo Supabase Auth, com fluxo PKCE.
   - O *client secret* do OAuth App fica no Supabase, nunca no bundle.
   - O retorno do login é a própria raiz do app (`/graph-builder/?code=…`). Rota separada não
     funcionaria no Pages, que responde `404.html` a caminhos desconhecidos.
4. **Só convidados:** "Allow new users to sign up" desligado no Supabase; o dono cadastra o
   convidado pelo painel com um e-mail **verificado na conta do GitHub** dele. No primeiro login, o
   Supabase liga a identidade do GitHub a esse usuário (Q7, resolvida abaixo).
5. **Autorização no banco:** Row Level Security em toda tabela, com política `owner_id =
   auth.uid()` para `select`, `insert`, `update` e `delete`. Sem sessão, a API não devolve nada.
6. **Chaves públicas no build:** a URL do projeto e a *publishable/anon key* entram no build como
   variáveis do GitHub Actions. Elas são públicas por desenho; quem protege os dados é o RLS. A
   *service role key* nunca entra no repositório, no CI do front nem no bundle.
7. **Fronteiras:** `@supabase/supabase-js` só aparece em `packages/core/src/infrastructure`
   (`SupabaseGraphRepository`, `SupabaseAuthGateway`). `domain` e `application` seguem sem
   dependência nova (NFR-02); a UI fala só com portas e casos de uso.
8. **Banco versionado:** o esquema e as políticas ficam em `supabase/migrations/` (Supabase CLI).
   Testes de integração e e2e rodam contra o Supabase **local** do CLI (Docker), nunca contra o
   projeto de produção.
9. **Sem build da nuvem, sem modo nuvem:** se as variáveis do Supabase não existirem no build (dev
   sem Docker, forks), o app mostra só o modo local, como na v1.

## Alternativas consideradas
- **Firebase (Auth + Firestore Rules):** equivalente em recursos. Rejeitado: Firestore é
  documento-NoSQL com regras numa linguagem própria; Postgres + RLS em SQL é mais fácil de versionar,
  testar localmente e migrar de fornecedor.
- **Auth0/Clerk + API própria (Workers/Edge Functions):** mais controle. Rejeitado: exige escrever e
  manter uma API e um banco à parte só para salvar JSON por dono, que o Supabase já faz com RLS.
- **Cloudflare Pages + Cloudflare Access:** esconderia o site inteiro. Rejeitado: o repositório é
  público (o bundle já é público de qualquer forma) e trocaria o GitHub Pages sem resolver os grafos
  na nuvem.
- **Local-first com sincronização automática:** mantém o offline na nuvem. Rejeitado na v2: exige
  resolver conflitos entre navegadores; a cópia explícita entre modos cobre a necessidade com uma
  fração do custo. Pode voltar numa v3.
- **Só nuvem (sem modo local):** mais simples. Rejeitado: o modo local é a proposta da v1 (offline,
  nada sai do navegador) e não custa nada mantê-lo.
- **Papéis (admin/usuário) ou allowlist por domínio:** desnecessário para um grupo pequeno de
  convidados; o convite pelo painel basta. Fica como evolução.

## Consequências
- **Positivas:**
  - o app continua estático no GitHub Pages, sem servidor nosso para manter;
  - autorização de verdade no banco (RLS), testável com SQL;
  - o core ganha só adaptadores: a porta `GraphRepository` não muda;
  - quem não quer conta continua com a v1 intacta.
- **Negativas:**
  - dependência de um serviço externo para o modo nuvem (mitigada pela porta e pelo export JSON);
  - o modo nuvem não funciona offline;
  - os testes de integração e e2e da nuvem exigem Docker (Supabase CLI local);
  - um XSS passa a expor a sessão do usuário, não só dados locais.
- **Riscos:**
  - **Convidado sem o e-mail verificado no GitHub** cai em "acesso negado" (FR-51). O convite tem
    que usar um e-mail que a pessoa verificou no GitHub (qualquer um deles, não só o principal).
  - **Plano gratuito:** projetos inativos por uma semana são pausados. Aceitável para uso pessoal;
    reavaliar se houver mais usuários.
  - **Sessão no `localStorage`** (padrão do `supabase-js`): exposta a XSS. Mitigação: o Svelte
    escapa tudo por padrão, sem `{@html}` com dado do usuário; CSP por `<meta>` (o Pages não
    permite cabeçalhos).

## Resolução da Q7 (2026-11-19): convite por e-mail × login pelo GitHub
A documentação do Supabase não diz o que acontece com o cadastro fechado. A resposta veio do
código do servidor de auth (`supabase/auth` v2.198.0, de 2026-11-16):
`internal/api/provider/github.go`, `internal/models/linking.go` (`DetermineAccountLinking`) e
`internal/api/external.go` (`createAccountFromExternalIdentity`, `getErrorQueryString`).

1. **E-mails do GitHub:** o provedor pede o escopo `user:email` e lê todos os e-mails da conta, cada
   um com as marcas `verified` e `primary`.
2. **Vínculo:** o login procura usuários com algum dos e-mails **verificados** do GitHub (sem
   diferenciar maiúsculas). Achando exatamente um, a decisão é `LinkAccount`: a identidade do GitHub
   é ligada a ele. O usuário existente **não** precisa ter confirmado o e-mail, então um convidado
   que nunca abriu o convite também serve.
3. **Cadastro fechado:** `DisableSignup` só barra a decisão `CreateAccount` (nenhum usuário com
   esses e-mails). `LinkAccount` e `AccountExists` (logins seguintes) passam.
4. **Convidado não confirmado:** no vínculo, o servidor apaga identidades não confirmadas do usuário
   (proteção contra tomada de conta antecipada) e, se o e-mail principal do GitHub for verificado,
   confirma o usuário e emite a sessão.
5. **Sem convite:** erro `signup_disabled`; a volta ao app traz `error=access_denied`,
   `error_code=signup_disabled` e `error_description`. O app mapeia isso para `NOT_INVITED`
   (FR-51).

**Decisão:** o convite pelo painel basta; o *auth hook* "before user created" não é necessário. O
gate da L07 confirma isso na prática, contra o Supabase local (convidado entra; não convidado
recebe `signup_disabled`); o da L09, no projeto real.
