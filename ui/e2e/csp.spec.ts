// SPEC §9.4: a CSP vai numa `<meta>` do `build/index.html` (o que o Pages serve). O `vite preview`
// renderiza a página na hora e manda a mesma política por cabeçalho. As violações são conferidas
// em todos os specs pela fixture de `csp.ts`.
import { readFile } from 'node:fs/promises';
import { expect, test } from './csp.ts';
import { localCloud } from './local-cloud.ts';

const cloud = localCloud();
const connect = cloud === null ? ["'self'"] : ["'self'", new URL(cloud.url).origin];

function parse(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(';').map((part) => {
      const [name = '', ...sources] = part.trim().split(/\s+/u);
      return [name, sources] as const;
    }),
  );
}

function expectPolicy(policy: string) {
  const directives = parse(policy);
  const script = directives.get('script-src') ?? [];
  expect(script).toContain("'self'");
  expect(script.some((source) => source.startsWith("'sha256-"))).toBe(true);
  expect(script).not.toContain("'unsafe-inline'");
  expect(script).not.toContain("'unsafe-eval'");
  expect(directives.get('object-src')).toEqual(["'none'"]);
  expect(directives.get('connect-src')).toEqual(connect);
}

test('build/index.html traz a CSP em <meta>', async () => {
  const html = await readFile(new URL('../build/index.html', import.meta.url), 'utf8');
  const meta = /<meta http-equiv="content-security-policy" content="([^"]+)">/u.exec(html);
  expect(meta, 'meta da CSP no index.html').not.toBeNull();
  expectPolicy((meta?.[1] ?? '').replaceAll('&#39;', "'"));
});

test('o preview manda a mesma política por cabeçalho', async ({ page }) => {
  const response = await page.goto('/');
  expectPolicy((await response?.allHeaders())?.['content-security-policy'] ?? '');
});
