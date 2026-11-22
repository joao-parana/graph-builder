// Q8 (SPEC §12): o navegador lembra o último modo em `localStorage`, chave `graph-builder:mode`.
import type { StorageMode } from '@graph-builder/core';

export const MODE_KEY = 'graph-builder:mode';

/** O pedaço do `Storage` que a preferência usa (os testes passam um em memória). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Ao iniciar: `cloud` só com sessão válida e valor gravado `cloud`; o resto é local. */
export function readMode(store: KeyValueStore | null, signedIn: boolean): StorageMode {
  if (!signedIn || store === null) return 'local';
  try {
    return store.getItem(MODE_KEY) === 'cloud' ? 'cloud' : 'local';
  } catch {
    return 'local';
  }
}

/** Gravado a cada troca; storage bloqueado não é erro (só não lembra). */
export function writeMode(store: KeyValueStore | null, mode: StorageMode): void {
  try {
    store?.setItem(MODE_KEY, mode);
  } catch {
    // Navegação privada ou cota: a preferência é só uma conveniência.
  }
}

/** `localStorage`, ou `null` se o navegador bloquear o acesso. */
export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
