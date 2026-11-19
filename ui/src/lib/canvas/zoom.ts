// FR-07: zoom de 25% a 200%, em passos de 10 pontos percentuais.
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2;
const STEP_PERCENT = 10;

export function nextZoom(current: number, direction: 1 | -1): number {
  const percent = Math.round(current * 100) + direction * STEP_PERCENT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, percent / 100));
}
