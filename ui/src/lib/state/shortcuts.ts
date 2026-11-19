// Atalhos de teclado do editor (FR-03..05, FR-08). Puro: traduz a tecla numa ação.
export type ShortcutAction = 'delete' | 'duplicate' | 'undo' | 'redo' | 'cancel';

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  /** Elemento com o foco; em campo de texto os atalhos não agem. */
  readonly target: EventTarget | null;
}

const TEXT_INPUT = /^(INPUT|TEXTAREA|SELECT)$/u;

function isTyping(target: EventTarget | null): boolean {
  if (typeof target !== 'object' || target === null || !('tagName' in target)) return false;
  const element = target as { tagName: unknown; isContentEditable?: unknown };
  return (
    (typeof element.tagName === 'string' && TEXT_INPUT.test(element.tagName)) ||
    element.isContentEditable === true
  );
}

export function shortcutFor(event: KeyInput): ShortcutAction | null {
  if (isTyping(event.target)) return null;
  const command = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (command && !event.altKey) {
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'd' && !event.shiftKey) return 'duplicate';
    return null;
  }
  if (command || event.altKey) return null;
  if (key === 'delete' || key === 'backspace') return 'delete';
  if (key === 'escape') return 'cancel';
  return null;
}
