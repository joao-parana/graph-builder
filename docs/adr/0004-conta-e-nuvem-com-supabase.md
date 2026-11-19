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
4. **Só convidados:** "Allow new users to sign up" desligado no Supabase; o dono convida pelo
   painel. Ver a questão Q7 (vínculo do convite por e-mail com o login do GitHub).
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
  - **Q7 (vínculo convite × GitHub):** com o cadastro fechado, o login pelo GitHub só entra se a
    identidade se ligar ao usuário convidado por e-mail, o que depende do e-mail verificado no
    GitHub ser o mesmo. Validar num projeto de teste antes da L07. Se falhar: allowlist de usernames
    do GitHub num *auth hook* "before user created".
  - **Plano gratuito:** projetos inativos por uma semana são pausados. Aceitável para uso pessoal;
    reavaliar se houver mais usuários.
  - **Sessão no `localStorage`** (padrão do `supabase-js`): exposta a XSS. Mitigação: o Svelte
    escapa tudo por padrão, sem `{@html}` com dado do usuário; CSP por `<meta>` (o Pages não
    permite cabeçalhos).
