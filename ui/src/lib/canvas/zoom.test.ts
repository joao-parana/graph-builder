import { describe, expect, it } from 'vitest';
import { nextZoom } from './zoom.ts';

describe('nextZoom (FR-07)', () => {
  it.each([
    [1, 1, 1.1],
    [1, -1, 0.9],
    [0.93, 1, 1.03],
    [2, 1, 2],
    [1.95, 1, 2],
    [0.25, -1, 0.25],
    [0.3, -1, 0.25],
  ] as const)('%s %s → %s', (current, direction, expected) => {
    expect(nextZoom(current, direction)).toBe(expected);
  });
});
