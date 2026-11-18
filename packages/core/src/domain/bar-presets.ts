// "Preencher rápido — a barra" (FR-12, Q6). Os textos vão para a barra e para o prompt exportado.
import type { BarPresetId } from './model.ts';

export const BAR_PRESET_TEXT: Readonly<Record<BarPresetId, string>> = {
  wow: 'Todo crítico aprova com reação "uau".',
  'no-errors': 'Roda limpo, inclusive com casos de borda e erros forçados.',
  'concrete-evidence': 'Toda afirmação tem prova concreta.',
  'explicit-audience': 'O público-alvo está explícito no artefato.',
};

/** Ordem de exibição dos botões. */
export const BAR_PRESET_IDS: readonly BarPresetId[] = [
  'wow',
  'no-errors',
  'concrete-evidence',
  'explicit-audience',
];

/** Põe `text` numa linha nova no fim da barra, sem linha em branco extra. */
export function addPresetLine(bar: string, text: string): string {
  const trimmed = bar.trimEnd();
  return trimmed.length === 0 ? text : `${trimmed}\n${text}`;
}

/** Tira a primeira linha igual a `text`. Se o usuário editou a linha, a barra fica como está. */
export function removePresetLine(bar: string, text: string): string {
  const lines = bar.split('\n');
  const index = lines.findIndex((line) => line.trim() === text);
  if (index === -1) return bar;
  return lines.filter((_, i) => i !== index).join('\n');
}
