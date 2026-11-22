import { describe, expect, it } from 'vitest';
import { cspDirectives } from './csp.ts';

describe('cspDirectives (SPEC §9.4)', () => {
  it('sem Supabase: tudo só da própria origem', () => {
    const csp = cspDirectives(undefined);
    expect(csp['connect-src']).toEqual(['self']);
    expect(cspDirectives('  ')['connect-src']).toEqual(['self']);
    expect(csp['script-src']).toEqual(['self']);
    expect(csp['object-src']).toEqual(['none']);
    expect(csp['form-action']).toEqual(['none']);
  });

  it('com Supabase: libera só a origem do projeto (NFR-05)', () => {
    expect(cspDirectives('https://abc.supabase.co/')['connect-src']).toEqual([
      'self',
      'https://abc.supabase.co',
    ]);
    expect(cspDirectives('http://127.0.0.1:54321')['connect-src']).toEqual([
      'self',
      'http://127.0.0.1:54321',
    ]);
  });

  it('nunca libera script inline nem eval', () => {
    const csp = cspDirectives('https://abc.supabase.co');
    for (const sources of [csp['default-src'], csp['script-src']]) {
      expect(sources).not.toContain('unsafe-inline');
      expect(sources).not.toContain('unsafe-eval');
    }
  });

  it('URL inválida é erro de configuração', () => {
    expect(() => cspDirectives('ftp://x')).toThrow(/http:\/\/ ou https:\/\//);
  });
});
