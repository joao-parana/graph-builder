**Atenção:** este documento vale apenas para a instalação atual do projeto na conta joao-parana do GitHub. Para reproduzir o processo em suua conta do GitHub ajuste os valores e use este documento apenas como guia.

Para criar o projeto de produção, faça os passos de A a H abaixo. Antes, duas coisas sobre as variáveis que você já tem:

- **`SUPABASE_AUTH_EXTERNAL_GITHUB_*` são do OAuth App de desenvolvimento.** Elas estão definidas no Supabase local e apontam para o callback em `127.0.0.1`, e um OAuth App do GitHub aceita só um callback. A produção precisa de um OAuth App novo (passo D).
- **Não sei de qual projeto são `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` e `SUPABASE_DB_PASSWORD`.** Se forem de outro app, não use essas chaves aqui. Se forem de um projeto vazio feito para o Graph Builder, pule o passo A e use esse projeto.

---

### A. Crie o projeto

1. Abra https://supabase.com/dashboard
2. Clique em **New project**.
3. Escreva `graph-builder` no campo **Name**.
4. Selecione a região **South America (São Paulo)**.
5. Clique em **Generate a password**.
6. Guarde a senha no gerenciador de senhas.
7. Clique em **Create new project**.
8. Espere o status **Healthy**.
9. Copie o **Project ID** em **Project Settings → General**. Este é o `<ref>` dos passos seguintes. O valor salvo é `oobsowknnhkwverrwgan` que pode ser diferente em cada instância do Supabase

### B. Aplique as migrations

Faça estes comandos na raiz do worktree:

- `~/dev/code_with_ai/claude/graph-builder/.claude/worktrees/bun-homebrew-update-c2a999` # Valor depende do Claude

1. Faça o login na CLI:

```bash
bunx supabase login --output-format text
```

2. Ligue o repositório ao projeto:

```bash
bunx supabase link --output-format text --project-ref oobsowknnhkwverrwgan # este é o <ref>
```

3. Confira as migrations que vão ser aplicadas:

```bash
bunx supabase db push --remote --dry-run --output-format text
```

4. Confirme que a lista mostra só `20261119124437_graphs.sql`.
5. Aplique as migrations:

```bash
bunx supabase db push --remote --output-format text
```

6. Confira o histórico de migrations do projeto:

```bash
bunx supabase migration list --remote --output-format text
```

7. No painel, abra **Table Editor → graphs**.
OU
8. Confirme que a tabela mostra **RLS enabled** usando a query abaixo:

```sql
bunx supabase db query --remote --read-only --output-format text "select tablename, rowsecurity, (select count(*) from pg_policies p where p.tablename = t.tablename) as policies from pg_tables t where schemaname = 'public'"
```

> **CUIDADO:** não use `supabase config push`. Esse comando envia o `config.toml` local para a produção, e com ele a `site_url` em `127.0.0.1`.

> **CUIDADO:** na CLI 3.2, o `db push` sem `--remote` aplica as migrations no banco local, não na produção.

### C. Feche o cadastro e configure as URLs

1. Abra **Authentication → Sign In / Providers**.
2. Desligue **Allow new users to sign up**.
3. Clique em **Save changes**.
4. Abra **Authentication → URL Configuration**.
5. Escreva `https://joao-parana.github.io/graph-builder/` no campo **Site URL**.
6. Clique em **Save changes**.
7. Clique em **Add URL** em **Redirect URLs**.
8. Escreva `https://joao-parana.github.io/graph-builder/`.
9. Clique em **Save URLs**.

### D. Crie o OAuth App de produção no GitHub

1. Abra **GitHub → Settings → Developer settings → OAuth Apps**.
2. Clique em **New OAuth App**.
3. Preencha os campos:
   - **Application name:** `Graph Builder`
   - **Homepage URL:** `https://joao-parana.github.io/graph-builder/`
   - **Authorization callback URL:** `https://oobsowknnhkwverrwgan.supabase.co/auth/v1/callback`
4. Clique em **Register application**.
5. Clique em **Generate a new client secret**.
6. Guarde o **Client ID** e o **Client secret** no gerenciador de senhas.

> **CUIDADO:** não coloque o Client secret em arquivo do repositório nem em variável do GitHub. Ele fica só no painel do Supabase (passo E).

### E. Ligue o GitHub no Supabase

1. Abra **Authentication → Sign In / Providers → GitHub**.
2. Ligue **Enable Sign in with GitHub**.
3. Cole o **Client ID** do passo D.
4. Cole o **Client secret** do passo D.
5. Confirme que o **Callback URL** mostrado é igual ao do passo D.
6. Clique em **Save**.

### F. Convide um usuário

1. Abra **Authentication → Users**.
2. Clique em **Add user → Create new user**.
3. Escreva um e-mail verificado na sua conta do GitHub.
4. Escreva uma senha qualquer. O login é pelo GitHub, então a senha não é usada.
5. Ligue **Auto Confirm User**.
6. Clique em **Create user**.

### G. Configure as variables do GitHub Actions

1. No painel do Supabase, abra **Project Settings → API Keys**.
2. Copie a **Publishable key** (`sb_publishable_…`).
3. Defina as duas variables do repositório:

```bash
gh variable set PUBLIC_SUPABASE_URL --body "https://oobsowknnhkwverrwgan.supabase.co"
```

```bash
gh variable set PUBLIC_SUPABASE_KEY --body "$PUBLIC_SUPABASE_KEY" # A variável PUBLIC_SUPABASE_KEY deve existir na sessão do Terminal
```

4. Confira as variables:

```bash
gh variable list
```

> **CUIDADO:** não use a `SUPABASE_SERVICE_KEY` (`sb_secret_…`) aqui. Ela ignora o **RLS**. O build recusa essa chave, mas não a coloque em nenhuma variable nem secret do repositório.

### H. Fale com o Claude na sequência

1. Diga que os passos de A a G estão prontos.
2. Não mande chaves nem senhas no chat. O `<ref>` sozinho não é segredo.

Depois disso o Claude escreve a seção de produção no README e prepara os comandos da release para a `master`. Em seguida fazemos o gate manual da SPEC §9.5 no GitHub Pages.
