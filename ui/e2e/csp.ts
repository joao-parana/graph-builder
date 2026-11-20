// SPEC §9.4: todo e2e falha se a CSP barrar algo. Os specs importam `test` e `expect` daqui; a
// fixture automática registra cada `securitypolicyviolation` (também depois de recarregar).
import { test as base, expect } from '@playwright/test';

export { expect };
export type { Locator, Page } from '@playwright/test';

export const test = base.extend<{ cspGuard: undefined }>({
  cspGuard: [
    async ({ page }, use) => {
      const violations: string[] = [];
      await page.exposeFunction('__cspViolation', (text: string) => {
        violations.push(text);
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          const report = (window as unknown as { __cspViolation: (text: string) => void })
            .__cspViolation;
          report(`${event.effectiveDirective} bloqueou ${event.blockedURI || '(inline)'}`);
        });
      });
      await use(undefined);
      expect(violations, 'violações da CSP').toEqual([]);
    },
    { auto: true },
  ],
});
