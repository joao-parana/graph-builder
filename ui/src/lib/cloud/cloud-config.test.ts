import { describe, expect, it } from 'vitest';
import { cloudConfigFrom, redirectTo } from './config.ts';
import {
  checkSupabaseKey,
  checkSupabasePair,
  checkSupabaseUrl,
  PAIR_MESSAGE,
} from './env-rules.ts';

/** JWT sem assinatura válida: só o payload importa para a regra. */
const jwt = (payload: object) =>
  `e30.${btoa(JSON.stringify(payload)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_')}.x`;

describe('variáveis do build (SPEC §9.3)', () => {
  it('URL: vazia é ausente; http(s) passa; outra coisa é erro', () => {
    expect(checkSupabaseUrl(undefined)).toBeUndefined();
    expect(checkSupabaseUrl('  ')).toBeUndefined();
    expect(checkSupabaseUrl(' https://abc.supabase.co ')).toBe('https://abc.supabase.co');
    expect(checkSupabaseUrl('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321');
    expect(() => checkSupabaseUrl('ftp://x')).toThrow(/http:\/\/ ou https:\/\//);
    expect(() => checkSupabaseUrl('nada')).toThrow(/não é uma URL válida/);
  });

  it('chave: pública passa; a de serviço é recusada (NFR-09)', () => {
    expect(checkSupabaseKey(undefined)).toBeUndefined();
    expect(checkSupabaseKey('sb_publishable_abc')).toBe('sb_publishable_abc');
    expect(checkSupabaseKey(jwt({ role: 'anon' }))).toBe(jwt({ role: 'anon' }));
    expect(checkSupabaseKey('a.b')).toBe('a.b');
    expect(checkSupabaseKey('a.!!!.c')).toBe('a.!!!.c');
    expect(checkSupabaseKey(jwt({ sub: 1 }))).toBe(jwt({ sub: 1 }));
    expect(() => checkSupabaseKey('sb_secret_abc')).toThrow(/chave de serviço/);
    expect(() => checkSupabaseKey(jwt({ role: 'service_role' }))).toThrow(/chave de serviço/);
  });

  it('as duas ou nenhuma', () => {
    expect(() => {
      checkSupabasePair(undefined, undefined);
    }).not.toThrow();
    expect(() => {
      checkSupabasePair('http://x', 'k');
    }).not.toThrow();
    expect(() => {
      checkSupabasePair('http://x', '');
    }).toThrow(PAIR_MESSAGE);
    expect(() => {
      checkSupabasePair(undefined, 'k');
    }).toThrow(PAIR_MESSAGE);
  });

  it('config da nuvem só com as duas; volta do login na raiz do app', () => {
    expect(cloudConfigFrom(undefined, undefined)).toBeNull();
    expect(cloudConfigFrom('http://x', undefined)).toBeNull();
    expect(cloudConfigFrom('http://x', 'k')).toEqual({ url: 'http://x', key: 'k' });
    expect(redirectTo('http://localhost:5173', '/')).toBe('http://localhost:5173/');
    expect(redirectTo('https://joao-parana.github.io', '/graph-builder/')).toBe(
      'https://joao-parana.github.io/graph-builder/',
    );
  });
});
