import { describe, expect, it } from 'vitest';
import { type KeyInput, shortcutFor } from './shortcuts.ts';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: null,
  ...mods,
});

describe('shortcutFor', () => {
  it.each([
    [key('Delete'), 'delete'],
    [key('Backspace'), 'delete'],
    [key('Escape'), 'cancel'],
    [key('z', { metaKey: true }), 'undo'],
    [key('z', { ctrlKey: true }), 'undo'],
    [key('Z', { metaKey: true, shiftKey: true }), 'redo'],
    [key('d', { metaKey: true }), 'duplicate'],
    [key('D', { ctrlKey: true }), 'duplicate'],
  ] as const)('%j → %s', (input, action) => {
    expect(shortcutFor(input)).toBe(action);
  });

  it.each([
    [key('a')],
    [key('d', { metaKey: true, shiftKey: true })],
    [key('z', { metaKey: true, altKey: true })],
    [key('s', { ctrlKey: true })],
    [key('Delete', { metaKey: true })],
    [key('Backspace', { altKey: true })],
  ])('%j → nada', (input) => {
    expect(shortcutFor(input)).toBeNull();
  });

  it('não age com o foco em campo de texto', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(shortcutFor(key('Delete', { target: { tagName } as never }))).toBeNull();
    }
    const editable = { tagName: 'DIV', isContentEditable: true } as never;
    expect(shortcutFor(key('z', { metaKey: true, target: editable }))).toBeNull();
    expect(shortcutFor(key('Delete', { target: { tagName: 'DIV' } as never }))).toBe('delete');
    expect(shortcutFor(key('Delete', { target: {} as never }))).toBe('delete');
  });
});
