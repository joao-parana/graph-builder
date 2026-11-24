# Tutoriais do Graph Builder

Seis grafos, do menor laço ao pipeline completo. Cada tutorial monta um grafo no editor, mostra o
prompt exportado e o que observar ao rodar no Claude.

## Onde rodar

Use o Graph Builder na web, em <https://joao-parana.github.io/graph-builder/>: não é preciso
instalar nada. No topo, escolha onde os grafos ficam:

- **Neste navegador:** sem conta. Os grafos ficam só neste navegador, neste computador.
- **Na nuvem:** com login pelo GitHub, só para convidados (veja abaixo). Os grafos ficam na sua
  conta e abrem em outro computador.

Os tutoriais funcionam igual nos dois modos.

## Entrar na nuvem

O cadastro é fechado: só entra quem recebeu um convite.

1. Confira os e-mails **verificados** da sua conta do GitHub em
   <https://github.com/settings/emails>. Qualquer um deles serve, não só o principal.
2. Mande um e-mail para **joao.parana@gmail.com** com o assunto "Convite para o Graph Builder",
   informando um desses e-mails. O convite é feito para esse endereço.
3. Quando o convite for confirmado, abra o app, clique em **Na nuvem** e depois em
   **Entrar com GitHub**.

Se o app disser "Sua conta do GitHub não tem acesso à nuvem. Peça um convite.", o convite ainda
não foi feito ou foi feito para um e-mail que não está verificado na sua conta do GitHub.

Sem convite, use o modo **Neste navegador**: tudo nos tutoriais funciona igual.

## A trilha

| # | Tutorial | O que ensina |
|---|---|---|
| 01 | [Primeiro laço](01-primeiro-laco.md) | Entrada → Trabalhador → Supervisor → Entrega; retorno implícito; a barra |
| 02 | Triagem com Decisão *(em preparação)* | Decisão com fios de condição; Entrega que junta dois caminhos |
| 03 | Pesquisa com Memória *(em preparação)* | Memória com relações; escrever e consultar |
| 04 | Críticos em série *(em preparação)* | Supervisor → Supervisor; os quatro presets; "Se esgotar" |
| 05 | Entrega julgada *(em preparação)* | Supervisor que julga uma Entrega; "fase seguinte" |
| 06 | Pipeline SDD *(em preparação)* | Todas as peças e fios; crítico cego sem consultar a Memória do construtor |

## Usar um exemplo pronto

Cada tutorial tem o grafo pronto em [`exemplos/`](exemplos/). Baixe o `.json` e carregue no app com
**Abrir JSON**. O app sempre salva um grafo novo, com `id` próprio: nunca sobrescreve um grafo seu.

## Rodar no Claude

Os tutoriais rodam o prompt exportado de dois jeitos:

- **Com a skill `/executar-grafo` no Claude Code** (recomendado): ela isola cada peça num subagente,
  confere as linhas mensuráveis da barra por script e grava um log de cada rodada. A skill está em
  [`skill/executar-grafo/SKILL.md`](skill/executar-grafo/SKILL.md); o tutorial 01 explica como
  instalá-la.
- **À mão, no Claude Desktop:** cole o prompt numa conversa e abra cada Supervisor numa conversa
  nova, para o crítico não ver como o artefato foi feito.
