# Grafo: Revisão em série

## Objetivo
Publicar o artigo revisado.

## Como executar
Execute as etapas na ordem abaixo. Cada Trabalhador produz um artefato.
Cada Supervisor é um **crítico cego**: passe a ele **apenas o artefato**, nunca o raciocínio
de quem o construiu. Se reprovar, devolva o artefato e o parecer ao(s) construtor(es) e repita,
até as rodadas máx. do Supervisor; esgotadas, siga o "Se esgotar" dele.

## Entrada
_(sem instruções)_ → alimenta: Redator, Revisor de estilo

## Etapas
### 1. Redator (Trabalhador)
Instruções:
Escreva o rascunho.
Use o tom do briefing.
Recebe de: Entrada · Envia para: Revisor de estilo · Escreve em: Glossário

### 2. Revisor de estilo (Supervisor — crítico cego)
A barra:
Todo crítico aprova com reação "uau".
O público-alvo está explícito no artefato.
Julga o que vem de: Redator · Rodadas máx.: 3 · Se esgotar: entregar o melhor com ressalvas
Também recebe de: Entrada
Se reprovar, devolve para: Redator
Aprovado → Revisor técnico

### 3. Revisor técnico (Supervisor — crítico cego)
A barra: Reprove qualquer dado sem fonte.
Julga o que vem de: Revisor de estilo · Rodadas máx.: 5 · Se esgotar: parar e informar a falha
Se reprovar, devolve para: Redator
Aprovado → Rascunho final
Consulta: Glossário

### 4. Rascunho final (Entrega)
Instruções: _(sem instruções)_
Junte: Revisor técnico → artefato final.
Envia para: Auditor

### 5. Auditor (Supervisor — crítico cego)
A barra: Confira a ortografia.
Julga o que vem de: Rascunho final · Rodadas máx.: 3 · Se esgotar: entregar o melhor com ressalvas
Se reprovar, devolve para: Rascunho final
Aprovado → Triagem

### 6. Triagem (Decisão — escolha UM caminho)
Instruções: Veja o idioma do público.
Recebe de: Auditor · Escreve em: Glossário
- Se _(sem condição)_ → Publicação
- Se "precisa de tradução" → Tradução

### 7. Publicação (Entrega)
Instruções: Publique.
Junte: Triagem → artefato final.

### 8. Tradução (Entrega)
Instruções: Traduza.
Junte: Triagem → artefato final.
Consulta: Glossário

## Memória
- Glossário — relações: livres. Escrevem: Redator, Triagem. Consultam: Revisor técnico, Tradução.

## Saída esperada
Os artefatos de "Publicação", "Tradução".

<!-- graph-builder schemaVersion=1 graphId=g1 -->
