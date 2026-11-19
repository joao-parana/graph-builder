import { describe, expect, it } from 'vitest';
import { randomIds, systemClock } from '../../src/infrastructure/system.ts';

describe('systemClock', () => {
  it('devolve o instante atual em ISO-8601 UTC', () => {
    const before = Date.now();
    const now = systemClock.now();
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    expect(Date.parse(now)).toBeGreaterThanOrEqual(before);
  });
});

describe('randomIds', () => {
  it('gera UUIDs v4 distintos', () => {
    const ids = Array.from({ length: 100 }, () => randomIds.next());
    expect(new Set(ids).size).toBe(100);
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });
});
