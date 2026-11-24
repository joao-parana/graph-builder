// Confere os exemplos de docs/tutorial/ contra o app: "Abrir JSON", "Antes de exportar" limpo,
// formato canônico do JSON e o bloco do prompt no texto do tutorial igual ao renderPrompt.
import { describe, expect, it } from 'vitest';
import tutorial01 from '../../../../docs/tutorial/01-primeiro-laco.md?raw';
import example01 from '../../../../docs/tutorial/exemplos/01-primeiro-laco.json?raw';
import { importJson } from '../../src/application/index.ts';
import { validateGraph } from '../../src/domain/index.ts';
import { jsonGraphCodec } from '../../src/infrastructure/json-codec.ts';
import { renderPrompt } from '../../src/infrastructure/prompt-renderer.ts';

const TUTORIALS: readonly [string, string, string][] = [['01-primeiro-laco', example01, tutorial01]];

/** O bloco ````markdown da seção "5. O prompt exportado". */
function promptBlock(markdown: string): string {
  const section = markdown.slice(markdown.indexOf('## 5. O prompt exportado'));
  const start = section.indexOf('````markdown\n') + '````markdown\n'.length;
  return section.slice(start, section.indexOf('\n````', start) + 1);
}

const ctx = {
  ids: { next: () => 'novo' },
  clock: { now: () => '2026-01-01T00:00:00.000Z' },
};

describe.each(TUTORIALS)('docs/tutorial/%s', (_name, json, markdown) => {
  it('abre pelo "Abrir JSON"', () => {
    expect(importJson(ctx as never, json, jsonGraphCodec).ok).toBe(true);
  });

  const decoded = jsonGraphCodec.decode(json);
  if (!decoded.ok) throw new Error(JSON.stringify(decoded.error));
  const graph = decoded.value;

  it('passa no "Antes de exportar" sem erros nem alertas', () => {
    expect(validateGraph(graph)).toEqual([]);
  });

  it('está no formato canônico do app', () => {
    expect(jsonGraphCodec.encode(graph)).toBe(json);
  });

  it('o prompt da seção 5 é o renderPrompt do exemplo', () => {
    expect(promptBlock(markdown)).toBe(renderPrompt(graph));
  });
});
