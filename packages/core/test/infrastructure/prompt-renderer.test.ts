import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import spec from '../../../../SPEC.md?raw';
import { type Graph, NodeKind } from '../../src/domain/index.ts';
import { markdownPromptRenderer, renderPrompt } from '../../src/infrastructure/prompt-renderer.ts';
import { graph, node } from '../domain/fixtures.ts';
import { landingPagePrompt, minimalPrompt, reviewLoopPrompt } from './prompt-fixtures.ts';

const GOLDEN: readonly [string, () => Graph][] = [
  ['landing-page', landingPagePrompt],
  ['minimal', minimalPrompt],
  ['review-loop', reviewLoopPrompt],
];

/** O bloco ````markdown do SPEC §6. */
function specExample(): string {
  const section = spec.slice(spec.indexOf('## 6. Template do prompt exportado'));
  const start = section.indexOf('````markdown\n') + '````markdown\n'.length;
  return section.slice(start, section.indexOf('\n````', start) + 1);
}

describe('PromptRenderer — golden files (SPEC §6)', () => {
  it.each(GOLDEN)('%s.md', async (name, build) => {
    await expect(renderPrompt(build())).toMatchFileSnapshot(`../golden/${name}.md`);
  });

  it('o exemplo do SPEC §6 é o golden landing-page', () => {
    const rendered = renderPrompt(landingPagePrompt()).replace('graphId=g1', 'graphId=…');
    expect(specExample()).toBe(rendered);
  });

  it('grafo sem peças', () => {
    expect(renderPrompt(graph([]))).toBe(
      [
        '# Grafo: Meu grafo',
        '',
        '## Objetivo',
        'Entregar a headline da landing page.',
        '',
        '## Como executar',
        'Execute as etapas na ordem abaixo. Cada Trabalhador produz um artefato.',
        '',
        '## Etapas',
        '_(nenhuma etapa)_',
        '',
        '## Saída esperada',
        '_(nenhuma Entrega final)_',
        '',
        '<!-- graph-builder schemaVersion=1 graphId=g1 -->',
        '',
      ].join('\n'),
    );
  });

  it('a porta delega para renderPrompt', () => {
    const g = landingPagePrompt();
    expect(markdownPromptRenderer.render(g)).toBe(renderPrompt(g));
  });
});

describe('PromptRenderer — determinismo', () => {
  it.each(GOLDEN)('%s: mesma saída com peças e fios embaralhados', (_, build) => {
    const g = build();
    const expected = renderPrompt(g);
    fc.assert(
      fc.property(
        fc.shuffledSubarray([...g.nodes], { minLength: g.nodes.length }),
        fc.shuffledSubarray([...g.edges], { minLength: g.edges.length }),
        (nodes, edges) => {
          expect(renderPrompt({ ...g, nodes, edges })).toBe(expected);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('renderiza 2× igual', () => {
    const g = reviewLoopPrompt();
    expect(renderPrompt(g)).toBe(renderPrompt(g));
  });
});

describe('PromptRenderer — casos-limite (grafo que não passaria na validação)', () => {
  const text = renderPrompt(
    graph(
      [
        node(NodeKind.Input, 'in', { name: 'Entrada', instructions: 'Briefing', x: 0 }),
        node(NodeKind.Decision, 'd', { name: 'Escolha', instructions: 'Escolha.', x: 10 }),
        node(NodeKind.Worker, 'w', { name: 'W', instructions: 'Faça.', x: 20 }),
        node(NodeKind.Supervisor, 's', { name: 'Crítico', instructions: '', x: 30 }),
        node(NodeKind.Delivery, 'e', { name: 'Final', instructions: '', x: 40 }),
        {
          ...node(NodeKind.Memory, 'm', { name: 'Notas', instructions: 'linha 1\n\nlinha 3' }),
          kind: NodeKind.Memory,
          relations: ['ideia'],
        },
      ],
      [
        ['d', 'w', { id: 'z' }],
        ['d', 'w', { id: 'a', condition: 'b' }],
        ['w', 'fantasma'],
      ],
    ),
  );

  it('Entrada sem destino mostra só o texto', () => {
    expect(text).toContain('## Entrada\nBriefing\n\n');
  });

  it('Supervisor sem fios: só a barra e as rodadas', () => {
    expect(text).toContain(
      '(Supervisor — crítico cego)\nA barra: _(sem instruções)_\n' +
        'Rodadas máx.: 3 · Se esgotar: entregar o melhor com ressalvas\n\n',
    );
  });

  it('Decisão: condição ausente e empate de destino pelo id do fio', () => {
    expect(text).toContain('- Se "b" → W\n- Se _(sem condição)_ → W\n');
  });

  it('Entrega sem origem não tem "Junte"', () => {
    expect(text).toContain('### 4. Final (Entrega)\nInstruções: _(sem instruções)_\n\n');
  });

  it('instruções da Memória mantêm linha em branco sem recuo', () => {
    expect(text).toContain('- Notas — relações: `ideia`.\n  linha 1\n\n  linha 3\n');
  });

  it('fio com ponta inexistente é ignorado', () => {
    expect(text).not.toContain('fantasma');
    expect(text).toContain('Instruções: Faça.\nRecebe de: Escolha\n');
  });
});
