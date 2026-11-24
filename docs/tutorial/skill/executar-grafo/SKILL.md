---
name: executar-grafo
description: Executa um prompt Markdown exportado pelo Graph Builder ("Exportar para a IA" → Prompt) com cada peça em contexto isolado. Trabalhadores e Entregas rodam em subagentes que recebem só as próprias Instruções e insumos, em paralelo quando não dependem um do outro. Cada Supervisor checa por script as linhas mensuráveis da barra e roda o resto como crítico cego, num subagente novo que recebe só a barra e o artefato. Registra cada pacote enviado, veredito e parecer num log auditável. Use quando o usuário pedir para executar, rodar ou depurar um grafo exportado, ou digitar /executar-grafo.
argument-hint: <prompt.md> [entrada] [nome=valor …]
---

# /executar-grafo

Executa um grafo exportado pelo Graph Builder. Você (o agente principal) é o **orquestrador**:
monta os pacotes, chama os subagentes, faz a Decisão, mantém a Memória e grava o log. Você **não**
escreve os artefatos.

- **Trabalhador** e **Entrega** rodam num **subagente construtor**, que recebe só as próprias
  Instruções e o que chega pelos fios. Peças independentes rodam **em paralelo** (seção 3).
- **Supervisor**: as linhas mensuráveis da barra são checadas **por script** (gates, seção 4.1); o
  resto vai a um **subagente crítico novo por rodada**, que recebe só essas linhas e o artefato.

Isso faz o isolamento ser real: o crítico não tem a Entrada, as Instruções dos construtores nem o
seu raciocínio no contexto, e o construtor não tem a barra nem o contexto das outras peças. Sem
isso, quem escreve é o mesmo contexto que conhece a barra, e o laço quase nunca reprova.

## Argumentos

```
/executar-grafo <prompt.md> [entrada] [nome=valor …]
```

- `<prompt.md>`: obrigatório. Caminho do prompt exportado. Confira o rodapé
  `<!-- graph-builder schemaVersion=1 graphId=… -->`. Se ele faltar, avise e pergunte se segue.
- `[entrada]`: o insumo da seção `## Entrada` do prompt. Pode ser texto direto (ex.: só a primeira
  linha, `Público: diretoria`) ou o caminho de um arquivo. Se for caminho de arquivo existente,
  leia o arquivo.
  - Se o prompt tem `## Entrada` e o argumento faltou, ou não cobre o que a Entrada pede (ex.: veio
    só a linha do público e a Entrada pede também o texto), **pergunte** o que falta antes de
    começar. Não invente insumo.
  - Se o prompt não tem `## Entrada`, ignore o argumento.
- `[nome=valor …]`: **parâmetros**, não Entrada. Todo argumento no formato `nome=valor`, com
  `nome` casando `[a-z][a-z0-9_]*`, é um parâmetro (ex.: `max_palavras=80`). Os demais argumentos
  depois de `<prompt.md>` formam a Entrada. O valor é uma linha só; aspas em volta são removidas.

## 0. Resolver parâmetros

Faça isto **antes** de ler o grafo (seção 1). Os parâmetros seguem a convenção `{{nome}}`: o
texto do grafo traz marcadores com **chaves duplas**, e o Objetivo pode trazer uma linha de padrões:

```text
Parâmetros: max_palavras (padrão: 120), outro_nome (padrão: …).
```

Chave **simples** (ex.: `{público}`) é texto literal do grafo: não é parâmetro, não mexa.

1. Liste os marcadores `{{nome}}` distintos do prompt inteiro (regex `\{\{([a-z][a-z0-9_]*)\}\}`).
2. Para cada um, o valor vem, nesta ordem:
   1. do argumento `nome=valor`;
   2. senão, do padrão na linha `Parâmetros:` do `## Objetivo`;
   3. senão, **pergunte** ao usuário (como faz com a Entrada). Não invente valor.
3. Troque **todos** os marcadores pelo valor no texto inteiro do prompt, **antes** de extrair as
   etapas. Assim a barra chega já resolvida ao pacote do crítico (o Supervisor nunca vê o Objetivo
   nem a linha de padrões).
4. Parâmetro passado que não aparece no prompt: avise (`Parâmetro "{nome}" não aparece no prompt;
   ignorado.`) e siga.
5. Se sobrar algum `{{` no texto depois da troca (ex.: marcador com nome fora da regex), pare e
   diga qual.

Mostre ao usuário, junto com o resumo das etapas, os valores usados e a origem de cada um
(`argumento`, `padrão` ou `perguntado`). Sem marcadores no prompt, pule esta seção.

## 1. Ler o grafo

O prompt segue o template do SPEC §6 do Graph Builder. Extraia:

- `# Grafo: {nome}` e `## Objetivo`.
- `## Entrada`: o texto antes de `→ alimenta:` e os destinos.
- `## Etapas`: cada `### {n}. {nome} ({Tipo}…)`, na ordem. Por tipo:
  - **Trabalhador / Entrega / Decisão:** `Instruções:` (uma linha ou as linhas seguintes),
    `Recebe de`, `Envia para`, `Escreve em`, `Consulta`; numa Decisão, os itens
    `- Se "{condição}" → {destino}`; numa Entrega, `Junte: … → artefato final.`
  - **Supervisor:** `A barra:` (as linhas até a linha `Julga o que vem de:`),
    `Julga o que vem de`, `Rodadas máx.`, `Se esgotar`, `Também recebe de`,
    `Se reprovar, devolve para`, `Aprovado →`, `Escreve em`, `Consulta`.
- `## Memória`: nome, relações, quem escreve e quem consulta.
- `## Saída esperada`.

Antes de executar, mostre ao usuário:

- um resumo de uma linha por etapa (nome, tipo, de onde recebe, para onde envia);
- as **ondas** de construtores que vão rodar em paralelo (seção 3);
- em cada Supervisor, quais linhas da barra viram gate (seção 4.1) e quais vão ao crítico.

Se faltar algo obrigatório (ex.: Supervisor sem barra), pare e diga o quê.

## 2. Preparar o registro

Crie a pasta da execução:

- `anotacoes/execucoes/{AAAA-MM-DD-HHMM}-{slug do nome do grafo}/` se existir `anotacoes/` na
  pasta atual; senão, `execucoes/{…}/`.

Arquivos:

- `entrada.md`: a Entrada usada, exatamente como veio.
- `parametros.md`: só se o prompt tem marcadores. Uma linha por parâmetro:
  `- {nome} = {valor} ({argumento | padrão | perguntado})`.
- `rodadas.md`: o log (formato na seção 5).
- `artefato-final.md`: o que a `## Saída esperada` pede.

## 3. Executar as etapas

Guarde o **artefato** de cada peça pelo nome dela. A Entrada é o artefato da peça de Entrada.

### Ondas (paralelismo)

Uma peça está **pronta** quando todas as peças de `Recebe de` (ou de `Junte:`) já têm artefato
(aprovado, se passam por Supervisor) e, se ela tem `Consulta`, quando todas as peças que escrevem
nessa Memória já rodaram. Peças **fora do caminho** (as que uma Decisão deixou de fora, ver
"Decisão e Memória") não contam: uma Entrega que junta dois caminhos de uma Decisão fica pronta
com as peças que chegaram. Se nenhuma peça de `Recebe de`/`Junte:` chegou, a peça também fica fora
do caminho. Rode em **ondas**:

1. Junte as peças prontas que ainda não rodaram. Essa é a onda.
2. Chame os subagentes de **todos** os construtores da onda **na mesma mensagem** (vários tool
   Agent em paralelo). Decisões e Supervisores da onda seguem as regras abaixo.
3. Espere a onda inteira, guarde os artefatos e repita até não sobrar peça pronta.

Duas peças só rodam juntas se nenhuma depende da outra. O log segue a ordem de `## Etapas`, não a
ordem em que as respostas chegaram.

### Construtor (Trabalhador e Entrega) em subagente

1. Monte o **pacote do construtor** com o modelo abaixo. Ele leva só:
   - as Instruções da peça, copiadas como estão (numa Entrega, também a linha `Junte:`, só com
     as peças que chegaram);
   - os artefatos das peças de `Recebe de` (ou de `Junte:`) que chegaram, um bloco por peça, com o
     nome dela. Peça fora do caminho não entra no pacote, nem como aviso;
   - a Memória, **só** se a peça tiver `Consulta`;
   - as relações permitidas, **só** se a peça tiver `Escreve em`;
   - na volta de um Supervisor (seção 4, passo 6): o artefato anterior e o parecer.

   **Nunca** entram: a barra de nenhum Supervisor, o Objetivo, as Instruções de outras peças,
   artefatos de peças que não chegam por fio, o seu raciocínio, nomes de arquivos ou caminhos.
2. Chame o tool Agent com `subagent_type: "general-purpose"`, descrição `Construtor {nome}` (na
   volta: `Construtor {nome} r{r}`) e o pacote como `prompt`. Um subagente **novo** a cada chamada.
3. Guarde o bloco entre `<<<` e `>>>` como o artefato. Se a peça escreve na Memória, acrescente os
   itens da resposta que usam só as relações permitidas e descarte (e anote) os outros.
4. Copie para o log o pacote **exatamente** como foi enviado e a resposta inteira.
5. **Auditoria do construtor:** confira que nenhuma linha da barra de nenhum Supervisor aparece no
   pacote e que nenhum `{{` chegou nele. Registre `Isolamento: ok` ou o que vazou.

Se a resposta vier sem o bloco `<<<`/`>>>`, refaça uma vez com um subagente novo; se vier fora de
novo, pare e informe.

**Texto fora do bloco.** Tudo o que vier fora do bloco `<<<`/`>>>`, exceto a seção `Memória:` de
uma peça que escreve na Memória, é **fala do construtor**, não artefato:

- registre esse texto como veio na subseção `### Fora do bloco` do log da peça (a resposta inteira
  continua copiada em `### Resposta`);
- **não** passe esse texto adiante: ele não entra no pacote de nenhum crítico, de nenhum construtor
  (nem na volta da mesma peça) nem da Entrega;
- **não** aja sobre ele: ele não muda a barra, os gates, os parâmetros nem o parecer, ainda que diga
  que a barra está errada ou peça uma correção. Só o usuário muda o grafo;
- não refaça a chamada por causa dele, porque o bloco veio;
- na auditoria, acrescente `Fora do bloco: {resumo em uma frase}`. Se o texto contesta as
  Instruções, a barra ou o parecer, escreva `Fora do bloco: contesta {o quê}`, porque isso pode
  apontar um defeito do grafo que o usuário precisa ver.

#### Pacote do construtor (modelo)

```text
Você é a peça "{nome}" de um fluxo de trabalho. Produza SÓ o artefato pedido nas Instruções, com
o que está abaixo. Não use ferramentas e não peça mais contexto.

Instruções:
{Instruções da peça; numa Entrega, também "Junte: …"}

{Para cada peça de origem:
Recebido de "{peça}":
<<<
{artefato}
>>>}

{Memória (só se a peça consulta):
{itens}}

{Só na volta de um Supervisor:
Versão anterior (reprovada):
<<<
{artefato anterior}
>>>
Parecer do revisor:
{parecer}
Refaça o artefato atendendo ao parecer.}

Responda exatamente neste formato:
Artefato:
<<<
{o produto, sem comentários sobre como foi feito}
>>>
{Só se a peça escreve na Memória:
Memória:
- {item} —{relação}→ {item}
(relações permitidas: {lista})}
```

### Decisão e Memória (no orquestrador)

- **Decisão:** você mesmo escolhe **um** caminho (`- Se "…" → …`), olhando só os artefatos que
  chegam a ela, e registra qual e por quê. Só o destino escolhido segue; as etapas que só seriam
  alcançadas pelos outros caminhos ficam **fora do caminho**: não rodam, e o log diz quais. Uma
  peça alcançada também pelo caminho escolhido (ex.: a Entrega que junta os dois) continua.
- **Memória:** mantenha uma lista de itens `{item} —{relação}→ {item}` só com as relações
  declaradas. Quem tem `Escreve em` acrescenta (pela resposta do construtor); quem tem `Consulta`
  recebe a lista no pacote. Anote as escritas no log.
- **Supervisor:** seção 4.

## 4. Supervisor: gates e crítico cego em subagente

### 4.1 Gates (linhas checadas por script)

Uma linha da barra é um **gate** quando casa com um destes padrões (lista fechada; sem
correspondência exata, a linha vai ao crítico):

| Padrão na linha (ignorando caixa) | Checagem |
|---|---|
| `passar de {N} palavras` | palavras ≤ N |
| `tiver menos de {N} palavras` | palavras ≥ N |
| `passar de {N} caracteres` | caracteres ≤ N |
| `não começar com "{texto}"` | o artefato, sem espaços no início, começa com `{texto}` |

Conte com script, nunca de cabeça. Passe o artefato pela entrada padrão:

```bash
# palavras: só tokens com letra ou dígito (marcadores de Markdown como "-" e "**" não contam)
python3 -c "import re,sys;print(len([w for w in sys.stdin.read().split() if re.search(r'\w',w)]))"
# caracteres (sem o \n final)
python3 -c "import sys;print(len(sys.stdin.read().rstrip('\n')))"
```

### 4.2 Rodadas

Para cada rodada `r` de 1 até `Rodadas máx.`:

1. **Gates.** Rode a checagem de cada gate no artefato atual. Registre cada um como
   `- {linha}: ✓ ou ✗ — {medida} (script)`.
   - Algum gate com ✗: a rodada é **REPROVADO**, sem chamar o crítico. O parecer é gerado pelo
     script, uma mudança por gate reprovado (ex.: `Corte para até 120 palavras; hoje tem 190.`).
     Vá ao passo 6.
   - Todos com ✓ e nenhuma linha sobrou para o crítico: a rodada é **APROVADO**. Vá ao passo 6.
2. Monte o **pacote do crítico** com exatamente o modelo abaixo. Ele leva só:
   - as linhas da barra que **não** são gate, copiadas como estão;
   - os artefatos atuais das peças de `Julga o que vem de`, um bloco por peça, rotulado só como
     "Artefato" (com o nome da peça se houver mais de um);
   - a Memória, **só** se o Supervisor tiver `Consulta`.

   **Nunca** entram: a Entrada, o Objetivo, as Instruções de outras peças, pareceres de rodadas
   anteriores, o resultado dos gates, o seu raciocínio, nomes de arquivos ou caminhos.
3. Chame o tool Agent com `subagent_type: "general-purpose"`, descrição
   `Crítico {nome} r{r}` e o pacote como `prompt`. Use um subagente **novo** a cada rodada; nunca
   continue um anterior com SendMessage, porque ele lembraria da rodada passada.
4. Copie para o log o pacote **exatamente** como foi enviado e a resposta inteira.
5. **Auditoria da cegueira:** confira que nenhuma linha da Entrada (com mais de 5 palavras) nem
   das Instruções dos construtores aparece no pacote. Confira também se o parecer cita algo que não
   está no pacote, e que **nenhum `{{`** chegou ao pacote (marcador não resolvido). Registre
   `Cegueira: ok` ou o que vazou.
6. **Resultado da rodada:** APROVADO só se todos os gates e todas as linhas do crítico tiverem ✓.
   **Não verificado não é aprovado:** uma linha `?` (o crítico não conseguiu conferir só pelo
   artefato) conta como não cumprida, e a rodada é REPROVADO. Gate nunca dá `?`: o script mede.
   - **APROVADO:** o artefato segue para `Aprovado →`. Pare as rodadas.
   - **REPROVADO** e `r < Rodadas máx.`: devolva o artefato e o parecer (do script, do crítico ou
     dos dois; para uma linha `?`, o parecer diz o que falta no artefato para ela ser conferida)
     aos construtores de `Se reprovar, devolve para`. Eles refazem, só eles, cada um num
     subagente novo (seção 3), sem rodar de novo as etapas anteriores. Depois volte ao passo 1 com
     `r + 1`.
   - **REPROVADO** na última rodada: siga o `Se esgotar`:
     - `entregar o melhor com ressalvas`: siga com a versão que mais linhas da barra cumpriu (só
       ✓ conta), contando gates e crítico (empate: a mais recente), e acrescente uma seção
       `Ressalvas` em duas listas: **Não cumpre** (linhas ✗) e **Não verificado** (linhas `?` e
       linhas do crítico que não foram julgadas nessa versão, com `crítico não chamado` quando um
       gate reprovou antes). Toda linha da barra sem ✓ na versão entregue aparece numa das duas;
     - `parar e informar a falha`: pare a execução e informe o último parecer.

Com vários Supervisores em série, cada um tem o seu laço. Um reprovado devolve aos construtores
dele, que podem estar antes de outro Supervisor. Nesse caso, a versão refeita passa de novo pelos
Supervisores do caminho, a partir do primeiro.

### Pacote do crítico (modelo)

```text
Você é um crítico cego. Julgue SÓ o artefato abaixo, sem supor nada que não esteja nele.
Não use ferramentas e não peça mais contexto.

A barra (cada linha é um critério):
{linhas da barra que não são gate, linha por linha}

{Memória (só se o Supervisor consulta):
{itens}}

Artefato:
<<<
{artefato}
>>>

Para cada linha, use:
- ✓ se o artefato cumpre a linha;
- ✗ se o artefato não cumpre a linha;
- ? se não dá para conferir a linha só com o artefato (ex.: falta a fonte para checar um fato).
  Nunca marque ✓ por suposição: na dúvida, use ?.

Responda exatamente neste formato:
Veredito: APROVADO ou REPROVADO
- {linha 1 da barra}: ✓, ✗ ou ? — motivo em uma frase (no ?, diga o que falta para conferir)
- {linha 2 da barra}: ✓, ✗ ou ? — motivo em uma frase (no ?, diga o que falta para conferir)
…
Parecer: (só se REPROVADO) até 3 mudanças objetivas para cumprir as linhas com ✗ e tornar
conferíveis as linhas com ?.
```

APROVADO só se todas as linhas tiverem ✓ (nenhum ✗ nem ?). Se o crítico escrever APROVADO com
alguma linha ✗ ou ?, conte como REPROVADO e anote `Veredito incoerente` na auditoria. Se a
resposta vier fora do formato, refaça a mesma rodada uma vez com um subagente novo; se vier fora
de novo, conte como REPROVADO e anote.

## 5. Formato de `rodadas.md`

`````markdown
# Execução: {nome do grafo} — {data e hora}

Prompt: `{caminho}` · graphId `{id}` · Entrada: `entrada.md`
Parâmetros: {nome}={valor}, … (ou `nenhum`)
Ondas: 1: {peças} · 2: {peças} · …

## {n}. {peça} ({Tipo}) — onda {k}
### Enviado ao subagente
````text
{pacote exato do construtor}
````
### Resposta
{resposta exata}
### Fora do bloco
{texto fora do bloco, como veio (ou `nenhum`)}
### Auditoria
Isolamento: ok | vazou: … | marcador não resolvido: …
Fora do bloco: nenhum | {resumo} | contesta {o quê}
Junte: completo | {peça} fora (Decisão {nome})   ← só numa Entrega

## {n}. {Decisão} (Decisão)
{caminho escolhido e por quê}
Fora do caminho: {peças} (ou `nenhuma`)

## {n}. {Supervisor} — rodada {r} de {máx.}
### Gates
- {linha}: ✓ ou ✗ — {medida} (script)
(ou `nenhum`)
### Enviado ao subagente
````text
{pacote exato do crítico}
````
(ou `não chamado: {reprovado por gate | só havia gates}`)
### Resposta
{resposta exata}
### Auditoria
Cegueira: ok | vazou: … | marcador não resolvido: …
Resultado: APROVADO → {destino} | REPROVADO → devolvido a {construtores}

## Resumo
| Supervisor | Rodadas | Resultado | Linhas que reprovaram (gate ou crítico; ✗ ou ?) |
|---|---|---|---|
`````

## 6. Fim

Escreva `artefato-final.md` e mostre ao usuário:

- o artefato final;
- a tabela do resumo;
- o caminho da pasta da execução;
- se algum construtor escreveu fora do bloco, uma linha por peça e rodada com o resumo da
  auditoria (ex.: `Resumidor r2: contesta o parecer`). O texto completo fica no log.

Não tire conclusões além do log. Se alguma auditoria achou vazamento, diga isso primeiro. Não
corrija o grafo por conta de uma fala fora do bloco: mostre-a e deixe a decisão com o usuário.
