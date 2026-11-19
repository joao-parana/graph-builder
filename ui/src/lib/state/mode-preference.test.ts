import { describe, expect, it } from 'vitest';
import { type KeyValueStore, MODE_KEY, readMode, writeMode } from './mode-preference.ts';

class MapStore implements KeyValueStore {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const blocked: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('preferência de modo (Q8)', () => {
  it('nuvem só com sessão e valor gravado "cloud"', () => {
    const store = new MapStore();
    expect(readMode(store, true)).toBe('local');
    writeMode(store, 'cloud');
    expect(store.values.get(MODE_KEY)).toBe('cloud');
    expect(readMode(store, true)).toBe('cloud');
    expect(readMode(store, false)).toBe('local');
    store.setItem(MODE_KEY, 'outro');
    expect(readMode(store, true)).toBe('local');
  });

  it('storage bloqueado ou ausente vira local, sem erro', () => {
    expect(readMode(blocked, true)).toBe('local');
    expect(readMode(null, true)).toBe('local');
    expect(() => {
      writeMode(blocked, 'cloud');
      writeMode(null, 'cloud');
    }).not.toThrow();
  });
});
