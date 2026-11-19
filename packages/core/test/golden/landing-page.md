# Grafo: Landing page do produto X

## Objetivo
Entregar a headline e o primeiro parágrafo da landing page do produto X.

## Como executar
Execute as etapas na ordem abaixo. Cada Trabalhador produz um artefato.
Cada Supervisor é um **crítico cego**: passe a ele **apenas o artefato**, nunca o raciocínio
de quem o construiu. Se reprovar, devolva o artefato e o parecer ao(s) construtor(es) e repita,
até as rodadas máx. do Supervisor; esgotadas, siga o "Se esgotar" dele.

## Entrada
Cole aqui o briefing do produto. → alimenta: Trabalhador 1

## Etapas
### 1. Trabalhador 1 (Trabalhador)
Instruções: Escreva 5 headlines para o público do briefing.
Recebe de: Entrada · Envia para: Supervisor 1 · Escreve em: Memória 1

### 2. Supervisor 1 (Supervisor — crítico cego)
A barra: Reprove se a headline não citar o público.
Julga o que vem de: Trabalhador 1 · Rodadas máx.: 3 · Se esgotar: entregar o melhor com ressalvas
Se reprovar, devolve para: Trabalhador 1
Aprovado → Decisão 1

### 3. Decisão 1 (Decisão — escolha UM caminho)
Instruções: Olhe as headlines aprovadas e escolha um caminho.
Recebe de: Supervisor 1
- Se "há mais de uma headline aprovada" → Trabalhador 2
- Se "só uma aprovada" → Entrega 1

### 4. Trabalhador 2 (Trabalhador)
Instruções: Escreva o primeiro parágrafo para cada headline aprovada.
Recebe de: Decisão 1 · Envia para: Entrega 1 · Consulta: Memória 1

### 5. Entrega 1 (Entrega)
Instruções: Monte a headline e o parágrafo finais.
Junte: Decisão 1, Trabalhador 2 → artefato final.

## Memória
- Memória 1 — relações: `ideia`, `descartada_por`. Escrevem: Trabalhador 1. Consultam: Trabalhador 2.
  Guarde cada headline proposta e, quando descartada, o motivo.

## Saída esperada
O artefato de "Entrega 1".

<!-- graph-builder schemaVersion=1 graphId=g1 -->
